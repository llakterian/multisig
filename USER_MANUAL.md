# SafeShamba User Manual

## What is SafeShamba?

SafeShamba is a secure land purchase platform that uses blockchain technology and multisig custody to protect your transactions. Think of it as a digital escrow service where funds are held securely until all conditions are met.

## How It Works

SafeShamba uses a **4-phase workflow**:

1. **Intake & Discovery** - You submit your land requirements
2. **Safety Gate** - Due diligence and document verification
3. **Execution & Fiat Bridge** - Funds are released through secure channels
4. **Transfer Registry** - Title transfer and completion

## Getting Started

### Prerequisites
- A Web3 wallet (MetaMask, WalletConnect, etc.)
- Testnet ETH (Sepolia)
- A web browser

### Step 1: Connect Your Wallet

1. Open SafeShamba in your browser
2. Click **"Connect wallet"** in the top right
3. Approve the connection in your wallet
4. Your address will appear in the pill badge

### Step 2: Set Up the Factory

If you're deploying fresh:

1. Get testnet ETH from [faucet.sepolia.dev](https://faucet.sepolia.dev)
2. Run the deployment script:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```
3. Copy the **EscrowFactory address**
4. Paste it in the **Factory** field on the left

### Step 3: Load an Escrow

1. Paste the escrow contract address
2. Click **"Load escrow"**
3. The system will show you the current state and your role

## Using SafeShamba

### As a Client

If you're buying land:

| Action | Description |
|--------|-------------|
| **Select plot** | Choose the land plot during discovery |
| **Fund escrow** | Deposit ETH into multisig custody |
| **Verify document** | Confirm due diligence documents |
| **Proceed with purchase** | Move to execution phase |
| **Cancel** | Cancel before execution (refund available) |

### As a Notary

If you're the legal notary:

| Action | Description |
|--------|-------------|
| **Upload document** | Submit document hashes |
| **Set rates** | Configure deposit and facilitation fees |
| **Execute fiat bridge** | Process currency conversion |
| **Upload lodgement receipt** | Submit registry documents |
| **Complete transfer** | Finalize the transaction |

### As a Multisig Owner

If you're part of the multisig group:

| Action | Description |
|--------|-------------|
| **Submit authorized release** | Approve fund releases |
| **Purpose selection** | Choose DD fee, facilitation, or refund |

## Release Authorization

SafeShamba uses **state-gated releases** - funds can only be released when the workflow allows it:

| Release Type | When | To |
|-------------|------|-----|
| **DD Fee** | After funding | Treasury |
| **Facilitation Fee** | After completion | Treasury |
| **Refund** | After cancellation | Client |
| **Seller Proceeds** | After completion | Seller |

## Troubleshooting

### Common Issues

**"Wallet not connected"**
- Make sure MetaMask is installed
- Click "Connect wallet" and approve

**"Invalid escrow address"**
- Check the address is correct
- Ensure it's a SafeShamba escrow contract

**"Transaction failed"**
- Check you have enough ETH
- Verify you have the correct role
- Ensure the escrow is in the right state

### Getting Help

- **Documentation:** See `README.md`
- **Security:** See `SECURITY.md`
- **Issues:** Create a GitHub issue
- **Email:** support@safeshamba.com

## Security Notes

- **Never share your private key**
- **Always verify contract addresses** before interacting
- **Use hardware wallets** for large transactions
- **Test on Sepolia** before mainnet deployment
- **Report vulnerabilities** to security@safeshamba.com

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Sepolia | 11155111 | ✅ Active |
| Mumbai | 80001 | ✅ Available |
| BSC Testnet | 97 | ✅ Available |
| Mainnet | 1 | ⚠️ After audit |

---

**© 2026 SafeShamba**
*Secure land purchase with multisig custody*