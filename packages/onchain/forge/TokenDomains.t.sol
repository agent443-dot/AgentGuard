// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface DomainsVm {
    function createSelectFork(string calldata url) external returns (uint256);
    function envOr(string calldata name, string calldata fallbackValue) external view returns (string memory);
}

interface IDomainToken {
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}

/// The EIP-712 domains in src/evm/tokens.ts, which the signing gate requires an authorization to
/// carry, checked against each Base token's own DOMAIN_SEPARATOR. Robinhood's USDG is checked in
/// RobinhoodProbe.t.sol.
contract TokenDomainsTest {
    DomainsVm private constant vm = DomainsVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    // Base Sepolia USDC from shared/addresses.ts. Base mainnet USDC is not in shared yet (CR-005);
    // this is Circle's address as @x402/evm's default asset table lists it.
    address private constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address private constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function test_baseSepoliaUsdcIsUsdcVersion2() public {
        vm.createSelectFork(vm.envOr("BASE_SEPOLIA_FORK_RPC_URL", string("https://sepolia.base.org")));
        check(USDC_BASE_SEPOLIA, "USDC", "2");
    }

    function test_baseUsdcIsUsdCoinVersion2() public {
        vm.createSelectFork(vm.envOr("BASE_FORK_RPC_URL", string("https://mainnet.base.org")));
        check(USDC_BASE, "USD Coin", "2");
    }

    function check(address token, string memory name, string memory version) private view {
        bytes32 expected =
            keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes(version)), block.chainid, token));
        require(IDomainToken(token).DOMAIN_SEPARATOR() == expected, "the token's domain is not the one the gate signs");
    }
}
