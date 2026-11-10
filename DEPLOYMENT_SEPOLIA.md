# SafeShamba Sepolia Deployment

**Network:** Sepolia Testnet (Chain ID: 11155111)
**Deployer:** 0xe6C60B7D7D3bD476dE7e49bb3404d91Df235b311
**Deploy Date:** 2026-11-10

## Deployed Contracts

| Contract | Address | Etherscan |
|----------|---------|-----------|
| MultiSigWallet | `0x00449D7c7BfA2C31d7291E19A1348A96d7fe7824` | [View](https://sepolia.etherscan.io/address/0x00449D7c7BfA2C31d7291E19A1348A96d7fe7824) |
| NotaryMediatedEscrow | `0xA88011F2D6B6DE39DfDD0B14e4e14B1C4e4e1fB9` | [View](https://sepolia.etherscan.io/address/0xA88011F2D6B6DE39DfDD0B14e4e14B1C4e4e1fB9) |
| EscrowFactory | `0xCc3053474A6FBEA77c3DDcADFA0b987498455aa7` | [View](https://sepolia.etherscan.io/address/0xCc3053474A6FBEA77c3DDcADFA0b987498455aa7) |

## Configuration

### Frontend (app/.env)
```
VITE_FACTORY_ADDRESS=0xCc3053474A6FBEA77c3DDcADFA0b987498455aa7
VITE_ESCROW_ADDRESS=0xA88011F2D6B6DE39DfDD0B14e4e14B1C4e4e1fB9
```

### Test Escrow
A test escrow was created at: `0xF709210cd7082E2468bf6A90c9e0d76361808bbe`

## Test the Deployment

### 1. Check contract on Etherscan
Visit: https://sepolia.etherscan.io/address/0xCc3053474A6FBEA77c3DDcADFA0b987498455aa7

### 2. Test with frontend
```bash
cd app && npm run dev
# Open http://localhost:5173
```

### 3. Create a new escrow
```javascript
// Using the factory
const factory = await ethers.getContractFactory("EscrowFactory");
const escrowFactory = factory.attach("0xCc3053474A6FBEA77c3DDcADFA0b987498455aa7");

// Create escrow
const tx = await escrowFactory.createEscrowWithDefaultNotary(
    clientAddress,
    sellerAddress,
    ethers.utils.parseEther("5.0")
);
await tx.wait();
```

## Notes
- All contracts verified on Etherscan
- Frontend configured with deployed addresses
- Test escrow created with 5 ETH
- Full workflow tested during deployment