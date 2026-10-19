## MODIFIED Requirements

### Requirement: Sources Are Persisted by the Server

The server SHALL persist sources to a JSON file in a data directory
(configurable via the `DATA_DIR` environment variable) so they survive restarts.

#### Scenario: Sources survive a restart

- **WHEN** a source is saved and the server is restarted
- **THEN** the source is still returned by the list endpoint
