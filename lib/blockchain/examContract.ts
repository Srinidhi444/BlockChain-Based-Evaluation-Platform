import { ethers } from 'ethers';
import ExamIntegrityABI from '@/lib/blockchain/abi/ExamIntegrity.js';

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const contract = new ethers.Contract(
  process.env.EXAM_CONTRACT_ADDRESS!,
  ExamIntegrityABI.abi,
  wallet
);
export async function commitSubmissionToBlockchain(
  blockchainExamId: number,
  submissionId: string,
  fileHash: string
) {
  console.log("Exam ID:", blockchainExamId);
  console.log("Submission ID:", submissionId);
  console.log("File Hash:", fileHash);

  // Ensure submissionId is bytes32
  const submissionIdBytes32 = submissionId.startsWith("0x")
    ? submissionId
    : ethers.keccak256(ethers.toUtf8Bytes(submissionId));

  // Ensure fileHash is bytes32
  const fileHashBytes32 = fileHash.startsWith("0x")
    ? fileHash
    : `0x${fileHash}`;

  try {
    // 🔎 Check if already submitted
    const existing = await contract.getSubmission(
      blockchainExamId,
      submissionIdBytes32
    );

    console.log("On-chain submission:", existing);

    if (existing.submittedAt > 0) {
      throw new Error("Submission already exists on-chain");
    }

    // 🚀 Commit
    const tx = await contract.commitSubmissionHash(
      blockchainExamId,
      submissionIdBytes32,
      fileHashBytes32
    );

    const receipt = await tx.wait();
    return receipt.hash;

  } catch (err) {
    console.error("Blockchain revert:", err);
    throw err;
  }
}

export async function commitEvaluationToBlockchain(
  blockchainExamId: number,
  submissionId: string,
  evaluationHash: string
) {
  console.log("Exam ID:", blockchainExamId);
  console.log("Submission ID:", submissionId);
  console.log("Evaluation Hash:", evaluationHash);

  let submissionIdBytes32: string;

if (submissionId.startsWith("0X")) {
  submissionIdBytes32 = "0x" + submissionId.slice(2);
} 
else if (submissionId.startsWith("0x")) {
  submissionIdBytes32 = submissionId;
} 
else {
  submissionIdBytes32 = ethers.keccak256(
    ethers.toUtf8Bytes(submissionId)
  );
}
  // Ensure evaluationHash is bytes32
  const evaluationHashBytes32 = evaluationHash.startsWith("0x")
    ? evaluationHash
    : `0x${evaluationHash}`;

  try {
    // 🔎 Check submission exists & evaluation not already done
    const existing = await contract.getSubmission(
      blockchainExamId,
      submissionIdBytes32
    );

    console.log("On-chain submission:", existing);

    if (existing.submittedAt === 0) {
      throw new Error("Submission does not exist on-chain");
    }

    if (existing.evaluatedAt > 0) {
      throw new Error("Evaluation already exists on-chain");
    }

    
    // 🚀 Commit evaluation hash
    const tx = await contract.commitEvaluationHash(
      blockchainExamId,
      submissionIdBytes32,
      evaluationHashBytes32
    );

    const receipt = await tx.wait();
    return receipt.hash;

  } catch (err) {
    console.error("Blockchain revert:", err);
    throw err;
  }
}
export async function getSubmissionFromBlockchain(
  blockchainExamId: number,
  submissionId: string
) {
  let submissionIdBytes32: string;

  // Normalize submissionId → bytes32
  if (submissionId.startsWith("0X")) {
    submissionIdBytes32 = "0x" + submissionId.slice(2);
  } 
  else if (submissionId.startsWith("0x")) {
    submissionIdBytes32 = submissionId;
  } 
  else {
    submissionIdBytes32 = ethers.keccak256(
      ethers.toUtf8Bytes(submissionId)
    );
  }

  try {
    const result = await contract.getSubmission(
      blockchainExamId,
      submissionIdBytes32
    );

    return {
      fileHash: result[0],
      evaluationHash: result[1],
      submittedAt: Number(result[2]),
      evaluatedAt: Number(result[3]),
      exists: result[2] > 0
    };

  } catch (err) {
    console.error("Error fetching submission:", err);
    throw err;
  }
}

