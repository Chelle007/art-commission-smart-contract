# art_commission_ICP

## Overview

This project is a simple implementation of art commission platform, implemented in TypeScript using Azle framework. This project allows user set art commission to the artist, artist can accept, reject, and cancel the commission.

### Methods

#### Client

- **createClient**: Creates a new client account.
- **createCommission**: Sets a new art commission to specific artist.
- **approveCommission**: Ends the commission by approving the artwork submitted by artist.
- **requestRevision**: Requests artwork revision to the artist. The amount of revision requested cannot exceeds the maximum revision set by the artist.

#### Artist

- **createArtist**: Creates a new artist account.
- **acceptCommission**: Accepts the commission.
- **rejectCommission**: Reject the commission.
- **submitArtwork**: Submits the artwork.

#### Both Parties

- **cancelCommission**: Cancels the commission.

#### Others

- **readArtists**: Displays artist accounts.
- **readArtistById**: Finds artist account based on ID.
- **readCustomers**: Displays customer accounts.
- **readCustomerById**: Finds customer account based on ID.
- **readCommissions**: Displays commissions.
- **readCommissionById**: Finds commission based on ID.

## Installation

1. Clone the repository

   ```bash
    git clone https://github.com/Chelle007/art_commission_ICP
    ```

2. Install dependencies

    ```bash
    npm install
    ```

3. Start the IC local development environment

    ```bash
    dfx start --background --clean
    ```

4. Deploy the canisters to the local development environment

    ```bash
    dfx deploy
    ```
