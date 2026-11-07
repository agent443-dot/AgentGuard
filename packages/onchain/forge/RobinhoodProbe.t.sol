// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// The Foundry cheatcodes the probe uses. Named apart from AllowanceCap.t.sol's Vm, so the two files
/// never collide.
interface ProbeVm {
    function createSelectFork(string calldata url) external returns (uint256);
    function envOr(string calldata name, string calldata fallbackValue) external view returns (string memory);
    function sign(uint256 privateKey, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
    function addr(uint256 privateKey) external pure returns (address);
    function toString(bytes32 value) external pure returns (string memory);
    function toString(uint256 value) external pure returns (string memory);
    function toString(bytes calldata value) external pure returns (string memory);
    function rpc(string calldata method, string calldata params) external returns (bytes memory);
}

interface IUsdg {
    function name() external view returns (string memory);
    function decimals() external view returns (uint8);
    function DOMAIN_SEPARATOR() external view returns (bytes32);
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/// RH-1 research (CR-007): what Robinhood Chain actually holds, read from the chain itself. Each value
/// checked here comes from an official list (safe-deployments, safe-modules-deployments, Paxos docs),
/// and the probe fails on any difference, so a green run means the chain matches the list.
contract RobinhoodProbe {
    ProbeVm private constant vm = ProbeVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant CONSOLE = 0x000000000000000000636F6e736F6c652e6c6f67;

    // safe-deployments 1.37.67, v1.4.1 canonical, which lists 4663 and 46630; code hashes from the same files.
    address private constant SAFE_L2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    bytes32 private constant SAFE_L2_HASH = 0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff;
    address private constant PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    bytes32 private constant PROXY_FACTORY_HASH = 0x50c3cdc4074750a7a974204a716c999edd37482f907608d960b2b025ee0b3317;
    address private constant FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;
    bytes32 private constant FALLBACK_HANDLER_HASH = 0x7c6007a5d711cea8dfd5d91f5940ec29c7f200fe511eb1fc1397b367af3c42f9;
    // safe-modules-deployments 3.0.14, allowance-module 0.1.1, which lists 4663 and 46630. The hash is the
    // one CI read on Base mainnet (CR-005).
    address private constant MODULE = 0xAA46724893dedD72658219405185Fb0Fc91e091C;
    bytes32 private constant MODULE_HASH = 0x7aa63affdca06fe94576f00077ad61a02ccf203a5da31e1b4ed595df7b65cf3e;

    // USDG per Paxos's "USDG on Test Networks" and "USDG on Main Networks" pages, as search results
    // quote them; docs.paxos.com cannot be reached from the cloud sessions. Unverified until this passes.
    address private constant USDG_TESTNET = 0x7E955252E15c84f5768B83c41a71F9eba181802F;
    address private constant USDG_MAINNET = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;

    // EIP-712 and EIP-3009 as paxosglobal/paxos-token-contracts defines them (EIP712.sol,
    // EIP3009Definitions.sol); the domain is name() with version "1" (ClaimableRewardsBase.sol).
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    string private constant SIMULATE = '[{"blockStateCalls":[{"stateOverrides":{"0x000000000000000000000000000000000000a11c":{"balance":"0xde0b6b3a7640000"}},"calls":[{"from":"0x000000000000000000000000000000000000a11c","to":"0x00000000000000000000000000000000000b0b1d","value":"0x6f05b59d3b20000"},{"to":"0xca11bde05977b3631167028862be2a173976ca11","data":"0x4d2301cc00000000000000000000000000000000000000000000000000000000000b0b1d"}]}]},"latest"]';
    // getEthBalance's return value for 0.5 ETH, as hex in the JSON result.
    string private constant HALF_ETH_HEX = "00000000000000000000000000000000000000000000000006f05b59d3b20000";

    bytes32 private constant TRANSFER_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    function test_testnet() public {
        probe(vm.envOr("ROBINHOOD_TESTNET_RPC_URL", string("https://rpc.testnet.chain.robinhood.com")), 46630, USDG_TESTNET);
    }

    function test_mainnet() public {
        probe(vm.envOr("ROBINHOOD_MAINNET_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")), 4663, USDG_MAINNET);
    }

    function probe(string memory url, uint256 chainId, address usdg) private {
        vm.createSelectFork(url);
        require(block.chainid == chainId, "the RPC serves another chain");
        log(string.concat("chain id: ", vm.toString(block.chainid)));

        same("SafeL2 1.4.1", SAFE_L2, SAFE_L2_HASH);
        same("SafeProxyFactory 1.4.1", PROXY_FACTORY, PROXY_FACTORY_HASH);
        same("CompatibilityFallbackHandler 1.4.1", FALLBACK_HANDLER, FALLBACK_HANDLER_HASH);
        same("Allowance Module 0.1.1", MODULE, MODULE_HASH);

        IUsdg token = IUsdg(usdg);
        require(usdg.code.length > 0, "no contract at the USDG address");
        require(keccak256(bytes(token.name())) == keccak256("Global Dollar"), "USDG name is not Global Dollar");
        require(token.decimals() == 6, "USDG does not have 6 decimals");
        bytes32 domain = keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256("Global Dollar"), keccak256("1"), block.chainid, usdg)
        );
        log(string.concat("USDG DOMAIN_SEPARATOR: ", vm.toString(token.DOMAIN_SEPARATOR())));
        require(token.DOMAIN_SEPARATOR() == domain, "USDG's EIP-712 domain is not (Global Dollar, 1)");

        // A zero-value transferWithAuthorization signed against that domain: if the token implements
        // EIP-3009 as x402's exact scheme signs it, the nonce is marked used.
        uint256 key = uint256(keccak256("agentguard rh-1 probe"));
        address from = vm.addr(key);
        bytes32 nonce = keccak256(abi.encode("rh-1", chainId));
        uint256 validBefore = block.timestamp + 3600;
        bytes32 digest = keccak256(
            abi.encodePacked(
                hex"1901",
                domain,
                keccak256(abi.encode(TRANSFER_TYPEHASH, from, address(0xdead), uint256(0), uint256(0), validBefore, nonce))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        require(!token.authorizationState(from, nonce), "the probe's nonce is already used");
        token.transferWithAuthorization(from, address(0xdead), 0, 0, validBefore, nonce, v, r, s);
        require(token.authorizationState(from, nonce), "transferWithAuthorization did not use the nonce");
        log("USDG: EIP-3009 transferWithAuthorization accepted a signature over (Global Dollar, 1)");

        // simulate() needs eth_simulateV1 from the RPC. One simulated block gives a sender 1 ETH by
        // state override, sends 0.5 ETH to a fresh address, then reads that address's balance through
        // Multicall3. Unless the result carries exactly 0.5 ETH, the build fails: a provider that drops
        // the method, or answers it wrongly, turns CI red.
        bytes memory result = vm.rpc("eth_simulateV1", SIMULATE);
        log(string.concat("eth_simulateV1 result: ", vm.toString(result)));
        require(result.length > 0, "eth_simulateV1 returned an empty result");
        // vm.rpc may hand back the JSON text or the decoded value, so both forms are accepted.
        require(
            contains(result, bytes(HALF_ETH_HEX)) || contains(result, abi.encode(uint256(0.5 ether))),
            "eth_simulateV1 did not show the simulated 0.5 ETH"
        );
        log("eth_simulateV1: the simulated block moved exactly 0.5 ETH");
    }

    function contains(bytes memory haystack, bytes memory needle) private pure returns (bool) {
        for (uint256 i = 0; i + needle.length <= haystack.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < needle.length && found; j++) {
                found = haystack[i + j] == needle[j];
            }
            if (found) {
                return true;
            }
        }
        return false;
    }

    function same(string memory label, address at, bytes32 expected) private view {
        log(string.concat(label, " code hash: ", vm.toString(at.codehash)));
        require(at.codehash == expected, string.concat(label, " is not the canonical code"));
    }

    function log(string memory line) private view {
        (bool ok,) = CONSOLE.staticcall(abi.encodeWithSignature("log(string)", line));
        ok;
    }
}
