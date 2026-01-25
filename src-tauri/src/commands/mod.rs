mod connection;
mod query;
mod schema;
mod settings;

pub use connection::*;
pub use query::*;
pub use schema::*;
pub use settings::*;

use crate::db::DatabaseManager;
use crate::storage::StorageService;

pub struct TauriState {
    pub db: DatabaseManager,
    pub storage: StorageService,
}
