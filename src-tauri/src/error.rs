use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Not connected")]
    NotConnected,

    #[error("Connection {0} not found")]
    ConnectionNotFound(String),

    #[error("SQL error: {0}")]
    Sql(#[from] sqlx::Error),

    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("Invalid identifier: {0}")]
    InvalidIdentifier(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Configuration error: {0}")]
    Config(String),
}

impl Serialize for DbError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, DbError>;
