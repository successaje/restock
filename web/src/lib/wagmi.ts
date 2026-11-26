// Wallet connection for the customer pay flow. Injected wallets only (Valora,
// MetaMask, Rabby, …), discovered via EIP-6963, on Celo mainnet.
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { celo } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: { [celo.id]: http() },
  multiInjectedProviderDiscovery: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
