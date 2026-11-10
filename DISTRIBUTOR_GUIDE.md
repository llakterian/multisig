# SafeShamba Distributor Guide

## Overview

This guide explains how to distribute SafeShamba to your clients.

## What You're Distributing

| Component | Description |
|-----------|-------------|
| **Smart Contracts** | Audited Solidity contracts (EscrowFactory, NotaryMediatedEscrow, MultiSigWallet) |
| **Frontend** | React application with SafeShamba branding |
| **Documentation** | User manual, deployment guide, security audit |
| **License** | MIT + Commercial Agreement |

## Distribution Methods

### Method 1: Deploy and Share (Recommended)

You deploy the contracts once, then share the frontend URL with clients.

**Steps:**

1. **Deploy contracts** to Sepolia:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

2. **Configure frontend** with deployed addresses:
   ```bash
   cd app
   echo "VITE_FACTORY_ADDRESS=0x..." > .env
   echo "VITE_ESCROW_ADDRESS=0x..." >> .env
   npm run build
   ```

3. **Host the frontend**:
   - Upload `app/dist/` to Vercel, Netlify, or GitHub Pages
   - Share the URL with clients

4. **Clients use it**:
   - Connect their wallet
   - Interact with the deployed contracts
   - No additional setup needed

### Method 2: White-Label Deployment

Each client gets their own deployment.

**Steps:**

1. **Deploy contracts** for each client
2. **Customize branding** (logo, colors, domain)
3. **Provide dedicated support**
4. **Charge per deployment**

### Method 3: SaaS Platform

Host everything yourself.

**Steps:**

1. **Deploy contracts** once
2. **Host frontend** on your domain
3. **Charge subscription** for access
4. **Provide ongoing support**

## What to Send Your Distributor

### 1. Repository Access

Give your distributor read access to:
- `https://github.com/llakterian/multisig`

### 2. Deployed Contracts

If already deployed on Sepolia:

| Contract | Address |
|----------|---------|
| EscrowFactory | `0xCc3053474A6FBEA77c3DDcADFA0b987498455aa7` |
| NotaryMediatedEscrow | `0xA88011F2D6B6DE39DfDD0B14e4e14B1C4e4e1fB9` |
| MultiSigWallet | `0x00449D7c7BfA2C31d7291E19A1348A96d7fe7824` |

### 3. Frontend URL

If already hosted:
- **URL:** [your-frontend-url]
- **Testnet:** Sepolia
- **Wallet:** MetaMask required

### 4. Documentation

Include these files:
- `README.md` - Overview
- `USER_MANUAL.md` - User instructions
- `DEPLOYMENT_SEPOLIA.md` - Deployment details
- `TESTNET_DEPLOYMENT.md` - Setup guide
- `SECURITY_AUDIT_SUMMARY.md` - Security information
- `COMMERCIAL_LICENSE.md` - License terms

## Pricing Model Suggestions

### Option A: Per Transaction
- Charge a small fee per escrow transaction
- Example: 0.1% of transaction value

### Option B: Subscription
- Monthly/annual fee for access
- Example: $99/month

### Option C: One-Time License
- Single payment for deployment
- Example: $2,999 one-time

### Option D: Revenue Share
- You take a percentage of facilitation fees
- Example: 20% of all facilitation fees

## Support Package

### Basic ($99/month)
- Documentation access
- Email support
- Bug fixes

### Pro ($299/month)
- Everything in Basic
- Priority support
- Custom branding
- Deployment assistance

### Enterprise ($999/month)
- Everything in Pro
- Dedicated account manager
- Custom development
- SLA guarantee

## Marketing Materials

### Key Features to Highlight
1. **Multisig Security** - Funds protected by multiple signatures
2. **Notary Verification** - Legal oversight of transactions
3. **State-Gated Releases** - Funds only released when conditions met
4. **Audited Contracts** - Security reviewed by experts
5. **Testnet Ready** - Try before you buy

### Target Audience
- Land buyers and sellers
- Real estate agents
- Property developers
- Legal professionals
- Financial institutions

## Next Steps

1. **Choose a distribution method** (above)
2. **Set up pricing** (suggested models above)
3. **Prepare marketing materials**
4. **Deploy to testnet**
5. **Share with clients**

## Contact

- **Developer:** llakterian@gmail.com
- **Distributor:** cheru.sambu@longspear.co.ke
- **Support:** support@safeshamba.com
- **Security:** security@safeshamba.com

---

**Ready to distribute SafeShamba?**
Follow this guide and you'll be up and running in no time!