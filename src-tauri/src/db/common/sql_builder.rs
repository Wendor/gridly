use crate::error::{DbError, Result};

pub enum QuoteStyle {
    DoubleQuote,
    Backtick,
}

impl QuoteStyle {
    pub fn quote(&self, identifier: &str) -> String {
        match self {
            QuoteStyle::DoubleQuote => format!("\"{}\"", identifier.replace('"', "\"\"")),
            QuoteStyle::Backtick => format!("`{}`", identifier.replace('`', "``")),
        }
    }
}

pub fn validate_identifier(name: &str) -> Result<()> {
    if name.is_empty() {
        return Err(DbError::InvalidIdentifier("Empty identifier".to_string()));
    }

    let first_char = name.chars().next().unwrap();
    if !first_char.is_alphabetic() && first_char != '_' {
        return Err(DbError::InvalidIdentifier(format!(
            "Identifier must start with letter or underscore: {}",
            name
        )));
    }

    for ch in name.chars() {
        if !ch.is_alphanumeric() && ch != '_' && ch != '.' {
            return Err(DbError::InvalidIdentifier(format!(
                "Invalid character '{}' in identifier: {}",
                ch, name
            )));
        }
    }

    Ok(())
}

pub fn escape_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => {
            if *b {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        serde_json::Value::Null => "NULL".to_string(),
        serde_json::Value::String(s) => format!("'{}'", s.replace('\'', "''")),
        _ => format!("'{}'", value.to_string().replace('\'', "''")),
    }
}

pub fn build_update_sql(
    table_name: &str,
    changes: &std::collections::HashMap<String, serde_json::Value>,
    primary_keys: &std::collections::HashMap<String, serde_json::Value>,
    quote_style: QuoteStyle,
) -> Result<String> {
    validate_identifier(table_name)?;

    if changes.is_empty() {
        return Err(DbError::Config("No changes provided".to_string()));
    }

    let mut set_parts = Vec::new();
    for (k, v) in changes {
        validate_identifier(k)?;
        set_parts.push(format!("{} = {}", quote_style.quote(k), escape_value(v)));
    }

    let mut where_parts = Vec::new();
    for (k, v) in primary_keys {
        validate_identifier(k)?;
        if v.is_null() {
            where_parts.push(format!("{} IS NULL", quote_style.quote(k)));
        } else {
            where_parts.push(format!("{} = {}", quote_style.quote(k), escape_value(v)));
        }
    }

    Ok(format!(
        "UPDATE {} SET {} WHERE {}",
        quote_style.quote(table_name),
        set_parts.join(", "),
        where_parts.join(" AND ")
    ))
}

pub fn build_select_sql(
    table_name: &str,
    limit: i32,
    offset: i32,
    quote_style: QuoteStyle,
) -> Result<String> {
    validate_identifier(table_name)?;

    Ok(format!(
        "SELECT * FROM {} LIMIT {} OFFSET {}",
        quote_style.quote(table_name),
        limit,
        offset
    ))
}
