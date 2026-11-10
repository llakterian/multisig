const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Notary-Mediated Escrow System...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  // Testnet configuration - these are Hardhat's default test accounts
  const doddyNotary = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const sizlandTreasury = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const testSeller = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

  const defaultOwners = [
    deployer.address,
    doddyNotary,
    sizlandTreasury
  ];
  const numConfirmationsRequired = 2;

  // Deploy MultiSigWallet
  console.log("Step 1: Deploying MultiSigWallet...");
  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const multiSigWallet = await MultiSigWallet.deploy(defaultOwners, numConfirmationsRequired);
  await multiSigWallet.deployed();
  console.log("MultiSigWallet deployed to:", multiSigWallet.address);

  // Deploy NotaryMediatedEscrow
  console.log("\nStep 2: Deploying NotaryMediatedEscrow...");
  const NotaryMediatedEscrow = await ethers.getContractFactory("NotaryMediatedEscrow");
  const notaryMediatedEscrow = await NotaryMediatedEscrow.deploy(
    defaultOwners,
    numConfirmationsRequired,
    sizlandTreasury,
    deployer.address // factory
  );
  await notaryMediatedEscrow.deployed();
  console.log("NotaryMediatedEscrow deployed to:", notaryMediatedEscrow.address);

  // Deploy EscrowFactory
  console.log("\nStep 3: Deploying EscrowFactory...");
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const escrowFactory = await EscrowFactory.deploy(
    doddyNotary,
    defaultOwners,
    numConfirmationsRequired,
    sizlandTreasury
  );
  await escrowFactory.deployed();
  console.log("EscrowFactory deployed to:", escrowFactory.address);

  // Create a test escrow
  console.log("\nStep 4: Creating test escrow contract...");
  const testAmount = ethers.utils.parseEther("5.0");
  const createTx = await escrowFactory.createEscrowWithDefaultNotary(
    deployer.address, // client
    testSeller,
    testAmount
  );
  const receipt = await createTx.wait();
  const escrowCreatedEvent = receipt.events.find(e => e.event === "EscrowCreated");
  const testEscrowAddress = escrowCreatedEvent.args.escrowContract;
  console.log("Test escrow contract deployed at:", testEscrowAddress);

  // Executing full workflow
  console.log("\nStep 5: Executing full end-to-end workflow...");
  const testEscrow = await ethers.getContractAt("NotaryMediatedEscrow", testEscrowAddress);

  // 5.1: Intake
  console.log("  5.1: Creating intake (Phase 1)...");
  await (await testEscrow.createIntake(
    testAmount,
    1,
    "Farming",
    testSeller,
    doddyNotary
  )).wait();

  // 5.2: Discovery
  console.log("  5.2: Uploading gallery & Selecting plot (Phase 2)...");
  await (await testEscrow.uploadDigitalGallery(0)).wait();
  await (await testEscrow.selectPlot(0)).wait();

  // 5.3: Funding
  console.log("  5.3: Funding escrow (Phase 3)...");
  await (await testEscrow.fundEscrow(0, true, { value: testAmount })).wait();

  // 5.4: Due Diligence
  console.log("  5.4: Performing Due Diligence...");
  const reportHash = ethers.utils.id("DD Report");
  const searchHash = ethers.utils.id("Search Certificate");

  await (await testEscrow.uploadDocument(0, 1, reportHash)).wait(); // 1 is DueDiligenceReport
  await (await testEscrow.uploadDocument(0, 0, searchHash)).wait(); // 0 is SearchCertificate

  console.log("    Verifying documents as client...");
  await (await testEscrow.verifyDocument(0, 1)).wait(); // 1 is DueDiligenceReport
  await (await testEscrow.verifyDocument(0, 0)).wait(); // 0 is SearchCertificate -> Should complete DD

  // 5.5: Negotiation
  console.log("  5.5: Notary setting negotiated rates (Custom Percentages)...");
  await (await testEscrow.setNegotiatedRates(0, 1500, 300)).wait();

  // Get status
  const escrowDetails = await testEscrow.escrows(0);
  console.log("\nTest Escrow Final Status:");
  console.log("  State (Enum Index):", escrowDetails.state);
  console.log("  Deposit Amount:", ethers.utils.formatEther(escrowDetails.depositAmount), "ETH (15%)");
  console.log("  Facilitation Fee:", ethers.utils.formatEther(escrowDetails.facilitationFee), "ETH (3%)");
  console.log("  Final Balance:", ethers.utils.formatEther(escrowDetails.finalAmount), "ETH");

  console.log("\nExecution completed successfully!");
  console.log("\nDeployed addresses:");
  console.log("  MultiSigWallet:", multiSigWallet.address);
  console.log("  NotaryMediatedEscrow:", notaryMediatedEscrow.address);
  console.log("  EscrowFactory:", escrowFactory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nERROR during execution:", error);
    process.exit(1);
  });