use ssh2::Session;
use std::net::TcpStream;

use tokio::net::TcpListener;
use std::io::{Read, Write};
use crate::models::DbConnection;

pub struct SshTunnelService {
    stop_signal: Option<tokio::sync::oneshot::Sender<()>>,
}

impl SshTunnelService {
    pub fn new() -> Self {
        SshTunnelService { stop_signal: None }
    }

    pub async fn create_tunnel(
        &mut self,
        config: &DbConnection,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<u16, String> {
        // Validation moved inside the connection loop or check here once to fail fast
        if config.ssh_host.is_none() || config.ssh_user.is_none() {
            return Err("Missing SSH host or user".to_string());
        }

        // Start local listener
        let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
        let local_port = listener.local_addr().map_err(|e| e.to_string())?.port();
        
        let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
        self.stop_signal = Some(tx);

        let remote_host = remote_host.to_string();
        let config_clone = config.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                     _ = &mut rx => {
                        println!("Stopping SSH tunnel");
                        break;
                    }
                    Ok((socket, _)) = listener.accept() => {
                        let config = config_clone.clone();
                        let r_host = remote_host.clone();
                        let r_port = remote_port;
                        
                        tokio::spawn(async move {
                            let _ = tokio::task::spawn_blocking(move || {
                                // 1. Establish NEW SSH Session per connection
                                // This ensures thread safety as libssh2 Session is not thread safe
                                let ssh_host = config.ssh_host.as_ref().unwrap();
                                let ssh_port = config.ssh_port.as_ref().and_then(|p| p.parse::<u16>().ok()).unwrap_or(22);
                                let ssh_user = config.ssh_user.as_ref().unwrap();

                                let tcp = match TcpStream::connect(format!("{}:{}", ssh_host, ssh_port)) {
                                    Ok(t) => t,
                                    Err(e) => {
                                        eprintln!("Failed to connect to SSH server: {}", e);
                                        return;
                                    }
                                };
                                
                                let mut sess = match Session::new() {
                                    Ok(s) => s,
                                    Err(_) => return,
                                };
                                
                                sess.set_tcp_stream(tcp);

                                if let Err(e) = sess.handshake() {
                                     eprintln!("SSH Handshake failed: {}", e);
                                     return;
                                }
                                
                                let mut authenticated = false;
                                // Auth Logic
                                if let Some(password) = &config.ssh_password {
                                    if !password.is_empty() {
                                        if sess.userauth_password(ssh_user, password).is_ok() {
                                            authenticated = true;
                                        }
                                    }
                                }
                                if !authenticated {
                                    if let Some(key_path) = &config.ssh_key_path {
                                        if !key_path.is_empty() {
                                            if sess.userauth_pubkey_file(ssh_user, None, std::path::Path::new(key_path), None).is_ok() {
                                                authenticated = true;
                                            }
                                        }
                                    }
                                }
                                if !authenticated { // Try agent
                                     if sess.userauth_agent(ssh_user).is_ok() {
                                         authenticated = true;
                                     }
                                }
                                
                                if !authenticated || !sess.authenticated() {
                                    eprintln!("SSH Auth failed for new connection");
                                    return;
                                }

                                // 2. Open Channel
                                let mut channel = match sess.channel_direct_tcpip(&r_host, r_port, None) {
                                    Ok(c) => c,
                                    Err(e) => {
                                        eprintln!("Failed to open SSH channel: {}", e);
                                        return;
                                    }
                                };
                                
                                // 3. Forwarding Loop
                                let std_socket = socket.into_std().ok();
                                if std_socket.is_none() { return; }
                                let mut std_socket = std_socket.unwrap();
                                let _ = std_socket.set_nonblocking(true);
                                let _ = sess.set_blocking(false); // Non-blocking IO for forwarding

                                let mut buf_socket = [0u8; 8192];
                                let mut buf_channel = [0u8; 8192];
                                
                                loop {
                                    let mut did_work = false;
                                    
                                    // Read Socket -> Write Channel
                                    match std_socket.read(&mut buf_socket) {
                                        Ok(0) => return, // EOF
                                        Ok(n) => {
                                             let mut written = 0;
                                             while written < n {
                                                 match channel.write(&buf_socket[written..n]) {
                                                     Ok(w) => { written += w; did_work = true; }
                                                     Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                                         // Wait for channel to be writable?
                                                         // We can sleep briefly
                                                         std::thread::sleep(std::time::Duration::from_micros(100));
                                                     }
                                                     Err(_) => return, 
                                                 }
                                             }
                                        }
                                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {},
                                        Err(_) => return,
                                    }
                                    
                                    // Read Channel -> Write Socket
                                    match channel.read(&mut buf_channel) {
                                        Ok(0) => return, // EOF
                                        Ok(n) => {
                                            match std_socket.write_all(&buf_channel[0..n]) {
                                                Ok(_) => { did_work = true; },
                                                Err(_) => return,
                                            }
                                        }
                                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {},
                                        Err(_) => return,
                                    }
                                    
                                    if !did_work {
                                        std::thread::sleep(std::time::Duration::from_millis(1));
                                    }
                                }
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
