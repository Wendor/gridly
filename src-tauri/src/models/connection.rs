use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseDriver {
    Mysql,
    #[default]
    Postgres,
    Clickhouse,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub id: String,
    #[serde(rename = "type")]
    pub driver: DatabaseDriver,
    pub name: String,
    pub host: String,
    #[serde(deserialize_with = "deserialize_port")]
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    pub database: String,
    pub exclude_list: Option<String>,
    pub use_ssh: Option<bool>,
    pub ssh_host: Option<String>,
    #[serde(default, deserialize_with = "deserialize_option_port")]
    pub ssh_port: Option<u16>,
    pub ssh_user: Option<String>,
    pub ssh_password: Option<String>,
    pub ssh_key_path: Option<String>,
}

fn deserialize_port<'de, D>(deserializer: D) -> Result<u16, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum PortValue {
        Int(u16),
        String(String),
    }

    match PortValue::deserialize(deserializer)? {
        PortValue::Int(v) => Ok(v),
        PortValue::String(s) => s.parse().map_err(serde::de::Error::custom),
    }
}

fn deserialize_option_port<'de, D>(deserializer: D) -> Result<Option<u16>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum PortValue {
        Int(u16),
        String(String),
    }

    let v: Option<PortValue> = Option::deserialize(deserializer)?;
    match v {
        Some(PortValue::Int(i)) => Ok(Some(i)),
        Some(PortValue::String(s)) => {
            if s.is_empty() {
                Ok(None)
            } else {
                s.parse().map(Some).map_err(serde::de::Error::custom)
            }
        }
        None => Ok(None),
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSummary {
    pub id: String,
    #[serde(rename = "type")]
    pub driver: DatabaseDriver,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub database: String,
    pub exclude_list: Option<String>,
    pub use_ssh: Option<bool>,
    pub ssh_host: Option<String>,
    pub ssh_port: Option<u16>,
    pub ssh_user: Option<String>,
    pub ssh_key_path: Option<String>,
}

impl From<ConnectionConfig> for ConnectionSummary {
    fn from(c: ConnectionConfig) -> Self {
        ConnectionSummary {
            id: c.id,
            driver: c.driver,
            name: c.name,
            host: c.host,
            port: c.port,
            user: c.user,
            database: c.database,
            exclude_list: c.exclude_list,
            use_ssh: c.use_ssh,
            ssh_host: c.ssh_host,
            ssh_port: c.ssh_port,
            ssh_user: c.ssh_user,
            ssh_key_path: c.ssh_key_path,
        }
    }
}
