import { SignerWalletAdapterProps } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

const pkey = [
    23, 183, 198, 211, 111, 195,  68, 198,  86,   5, 247,
    91, 247, 155,  32,  83,  96, 144, 114, 192, 101, 101,
    30, 125,  72, 204, 100,  59, 136, 112, 201,  52,  67,
    11,   1, 150, 193,  56, 142, 245, 250,  70, 130,  65,
   204, 102,  98, 144, 108,  95,  24, 176,  19, 122, 107,
   120,  58, 117,  67, 252,  27, 107, 187, 233
]
const admin = Keypair.fromSecretKey(new Uint8Array(pkey));
const connection = new Connection(clusterApiUrl("devnet"));
export const configureAndSendCurrentTransaction = async (
    transaction: Transaction,
    connection: Connection,
    feePayer: PublicKey,
    signTransaction: SignerWalletAdapterProps['signTransaction']
) => {
    const blockHash = await connection.getLatestBlockhash();
    transaction.feePayer = feePayer;
    transaction.recentBlockhash = blockHash.blockhash;
    const signed = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({
        blockhash: blockHash.blockhash,
        lastValidBlockHeight: blockHash.lastValidBlockHeight,
        signature
    });
    return signature;
};
export async function recieveSOL(userAddress: string, amount: number, signTransaction: (...any: any[]) => any) {
    try {
        const publicKey = new PublicKey(userAddress);
        console.log(amount * LAMPORTS_PER_SOL);
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: admin.publicKey,
                lamports: amount * LAMPORTS_PER_SOL,
            })
        );
        const signature = await configureAndSendCurrentTransaction(
            transaction,
            connection,
            publicKey,
            signTransaction
        );
        console.log(`Signature: ${signature}`);
        return signature;
    } catch (e) {
        // window.location.reload()
        console.log(e);
        console.log(amount * LAMPORTS_PER_SOL);
    }
}
export async function sendSOL(userAddress: string, amount: number) {
    try {
      const publicKey = new PublicKey(userAddress);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: publicKey,
          lamports: amount * LAMPORTS_PER_SOL,
        })
      );
  
      const signature = await connection.sendTransaction(transaction, [admin]);
      await connection.confirmTransaction(signature, "processed");
  
      console.log(`Signature: ${signature}`);
      return signature;
    } catch (e) {
      console.log(e);
      console.log(amount * LAMPORTS_PER_SOL);
    }
  }