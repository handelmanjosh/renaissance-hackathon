import "@/styles/globals.css";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ConnectionProvider endpoint={clusterApiUrl(WalletAdapterNetwork.Devnet)}>
    <WalletProvider
      wallets={[new PhantomWalletAdapter()]}
      autoConnect={false}
      onError={(error, adapter) => {
        console.error(error, adapter);
      }}
    >
      <WalletModalProvider>
          <Component {...pageProps} />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
  );
}
  