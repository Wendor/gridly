use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use keyring::Entry;
use rand::{rngs::OsRng, RngCore};
use crate::error::Result;

const MASTER_KEY_SERVICE: &str = "gridly.master_key";
const MASTER_KEY_USER: &str = "app_secret";
const NONCE_SIZE: usize = 12;

pub struct EncryptionManager {
    master_key: Key<Aes256Gcm>,
}

impl EncryptionManager {
    pub fn new() -> Result<Self> {
        let key_bytes = Self::get_or_create_master_key()?;
        let master_key = *Key::<Aes256Gcm>::from_slice(&key_bytes);
        Ok(Self { master_key })
    }

    fn get_or_create_master_key() -> Result<Vec<u8>> {
        let entry = Entry::new(MASTER_KEY_SERVICE, MASTER_KEY_USER)
            .map_err(|e| crate::error::DbError::Config(format!("Failed to access keyring: {}", e)))?;

        match entry.get_password() {
            Ok(pwd) => {
                // Key is stored as base64 string
                let key_bytes = general_purpose::STANDARD
                    .decode(&pwd)
                    .map_err(|_| crate::error::DbError::Config("Failed to decode master key".to_string()))?;
                
                if key_bytes.len() != 32 {
                     return Err(crate::error::DbError::Config("Invalid master key length".to_string()));
                }
                Ok(key_bytes)
            }
            Err(_) => {
                // Generate new key
                let mut key = [0u8; 32];
                OsRng.fill_bytes(&mut key);
                
                let encoded = general_purpose::STANDARD.encode(key);
                entry
                    .set_password(&encoded)
                    .map_err(|e| crate::error::DbError::Config(format!("Failed to save master key to keyring: {}", e)))?;
                
                Ok(key.to_vec())
            }
        }
    }

    pub fn encrypt(&self, plaintext: &str) -> String {
        let cipher = Aes256Gcm::new(&self.master_key);
        
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_bytes())
            .expect("Encryption failed"); // Should not fail for valid key/input

        // Format: ENC:<nonce_b64>:<ciphertext_b64>
        format!(
            "ENC:{}:{}",
            general_purpose::STANDARD.encode(nonce_bytes),
            general_purpose::STANDARD.encode(ciphertext)
        )
    }

    pub fn decrypt(&self, encrypted_str: &str) -> Option<String> {
        if !encrypted_str.starts_with("ENC:") {
            return None;
        }

        let parts: Vec<&str> = encrypted_str.split(':').collect();
        if parts.len() != 3 {
             return None;
        }

        let nonce_bytes = general_purpose::STANDARD.decode(parts[1]).ok()?;
        let ciphertext = general_purpose::STANDARD.decode(parts[2]).ok()?;

        if nonce_bytes.len() != NONCE_SIZE {
            return None;
        }

        let cipher = Aes256Gcm::new(&self.master_key);
        let nonce = Nonce::from_slice(&nonce_bytes);

        match cipher.decrypt(nonce, ciphertext.as_ref()) {
            Ok(plaintext) => String::from_utf8(plaintext).ok(),
            Err(_) => {
                log::error!("Failed to decrypt content");
                None
            }
        }
    }
}
