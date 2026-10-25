## ADDED Requirements

### Requirement: Account Listing Syncs With Actual First

Before returning accounts, `GET /api/accounts` SHALL pull the latest changes
from the Actual server into the open session, on every request, without logging
in again or re-downloading the budget. If the pull fails for a reason other than
rate limiting, the server SHALL log a warning and return the accounts already
held locally. Rate-limit failures SHALL follow the existing backoff behavior.

#### Scenario: Account added remotely while the session is open

- **WHEN** an account is created in Actual after the session opened and accounts
  are requested
- **THEN** the pull runs on the existing session and the response includes the
  new account

#### Scenario: Pull fails

- **WHEN** the pull fails with a non-rate-limit error
- **THEN** the response is 200 with the locally known accounts and a warning is
  logged

#### Scenario: No extra logins

- **WHEN** accounts are requested repeatedly with unchanged settings
- **THEN** the server logs in to Actual once
