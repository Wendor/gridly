use ssh2::Session;
use std::io::{Read, Write};
use std::net::TcpStream;
use tokio::net::TcpListener;

use crate::error::Result;
use crate::models::ConnectionConfig;

pub struct SshTunnelService {
    stop_signal: Option<tokio::sync::oneshot::Sender<()>>,
}

impl SshTunnelService {
    pub fn new() -> Self {
        SshTunnelService { stop_signal: None }
    }

    pub async fn create_tunnel(
        &mut self,
        config: &ConnectionConfig,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<u16> {
        let _ssh_host = config.ssh_host.as_ref().ok_or_else(|| {
            crate::error::DbError::Ssh("Missing SSH host".to_string())
        })?;
        let _ssh_user = config.ssh_user.as_ref().ok_or_else(|| {
            crate::error::DbError::Ssh("Missing SSH user".to_string())
        })?;

        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let local_port = listener.local_addr()?.port();

        let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
        self.stop_signal = Some(tx);

        let remote_host = remote_host.to_string();
        let config_clone = config.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut rx => {
                        log::info!("Stopping SSH tunnel");
                        break;
                    }
                    Ok((socket, _)) = listener.accept() => {
                        let config = config_clone.clone();
                        let r_host = remote_host.clone();

                        tokio::spawn(async move {
                            let _ = tokio::task::spawn_blocking(move || {
                                handle_connection(config, r_host, remote_port, socket);
                            }).await;
                        });
                    }
                }
            }
        });

        Ok(local_port)
    }

    pub fn close(&mut self) {
        if let Some(tx) = self.stop_signal.take() {
            let _ = tx.send(());
        }
    }
}

impl Default for SshTunnelService {
    fn default() -> Self {
        Self::new()
    }
}

fn handle_connection(
    config: ConnectionConfig,
    remote_host: String,
    remote_port: u16,
    socket: tokio::net::TcpStream,
) {
    let ssh_host = match config.ssh_host.as_ref() {
        Some(h) => h,
        None => return,
    };
    let ssh_port = config
        .ssh_port
        .unwrap_or(22);
    let ssh_user = match config.ssh_user.as_ref() {
        Some(u) => u,
        None => return,
    };

    let tcp = match TcpStream::connect(format!("{}:{}", ssh_host, ssh_port)) {
        Ok(t) => t,
        Err(e) => {
            log::error!("Failed to connect to SSH server: {}", e);
            return;
        }
    };

    let mut sess = match Session::new() {
        Ok(s) => s,
        Err(e) => {
            log::error!("Failed to create SSH session: {}", e);
            return;
        }
    };

    sess.set_tcp_stream(tcp);

    if let Err(e) = sess.handshake() {
        log::error!("SSH Handshake failed: {}", e);
        return;
    }

    let authenticated = authenticate(&sess, ssh_user, &config);
    if !authenticated || !sess.authenticated() {
        log::error!("SSH Auth failed");
        return;
    }

    let mut channel = match sess.channel_direct_tcpip(&remote_host, remote_port, None) {
        Ok(c) => c,
        Err(e) => {
            log::error!("Failed to open SSH channel: {}", e);
            return;
        }
    };

    let std_socket = match socket.into_std() {
        Ok(s) => s,
        Err(_) => return,
    };
    let mut std_socket = std_socket;
    let _ = std_socket.set_nonblocking(true);
    sess.set_blocking(false);

    forward_data(&mut std_socket, &mut channel);
}

fn authenticate(sess: &Session, ssh_user: &str, config: &ConnectionConfig) -> bool {
    if let Some(password) = &config.ssh_password {
        if !password.is_empty() && sess.userauth_password(ssh_user, password).is_ok() {
            return true;
        }
    }

    if let Some(key_path) = &config.ssh_key_path {
        if !key_path.is_empty()
            && sess
                .userauth_pubkey_file(ssh_user, None, std::path::Path::new(key_path), None)
                .is_ok()
        {
            return true;
        }
    }

    sess.userauth_agent(ssh_user).is_ok()
}

fn forward_data(socket: &mut std::net::TcpStream, channel: &mut ssh2::Channel) {
    let mut buf_socket = [0u8; 8192];
    let mut buf_channel = [0u8; 8192];

    loop {
        let mut did_work = false;

        match socket.read(&mut buf_socket) {
            Ok(0) => return,
            Ok(n) => {
                let mut written = 0;
                while written < n {
                    match channel.write(&buf_socket[written..n]) {
                        Ok(w) => {
                            written += w;
                            did_work = true;
                        }
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            std::thread::sleep(std::time::Duration::from_micros(100));
                        }
                        Err(_) => return,
                    }
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(_) => return,
        }

        match channel.read(&mut buf_channel) {
            Ok(0) => return,
            Ok(n) => {
                if socket.write_all(&buf_channel[0..n]).is_ok() {
                    did_work = true;
                } else {
                    return;
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(_) => return,
        }

        if !did_work {
            std::thread::sleep(std::time::Duration::from_millis(1));
        }
    }
}
