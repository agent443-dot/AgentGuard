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

        // simulate() needs eth_simulateV1 from the RPC. The answer is logged, not asserted: a missing
        // method is a finding for RH-1, not a broken build.
        try this.simulateV1() {
            log("eth_simulateV1: supported");
        } catch (bytes memory reason) {
            log(string.concat("eth_simulateV1: NOT supported: ", string(reason)));
        }
        // The control: a method no node serves must fail the same way, or "supported" proves nothing.
        try this.call("eth_agentguardNoSuchMethod") {
            log("control: an unknown method did NOT fail, so the line above is not evidence");
        } catch {
            log("control: an unknown method fails, as it should");
        }
    }

    function call(string calldata method) external {
        vm.rpc(method, "[]");
    }

    /// External so a revert of the RPC call can be caught.
    function simulateV1() external {
        vm.rpc(
            "eth_simulateV1",
            '[{"blockStateCalls":[{"calls":[{"to":"0x0000000000000000000000000000000000000001","data":"0x"}]}]},"latest"]'
        );
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
