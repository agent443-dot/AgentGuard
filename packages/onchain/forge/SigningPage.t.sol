// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface PageVm {
    function createSelectFork(string calldata url) external returns (uint256);
    function envOr(string calldata name, string calldata fallbackValue) external view returns (string memory);
    function readFile(string calldata path) external view returns (string memory);
    function parseJsonAddress(string calldata json, string calldata key) external pure returns (address);
    function parseJsonBytes(string calldata json, string calldata key) external pure returns (bytes memory);
    function parseJsonUint(string calldata json, string calldata key) external pure returns (uint256);
    function prank(address sender) external;
    function toString(address value) external pure returns (string memory);
}

interface PageSafe {
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function isModuleEnabled(address module) external view returns (bool);
    function getModulesPaginated(address start, uint256 pageSize)
        external
        view
        returns (address[] memory array, address next);
}

interface PageModule {
    function delegates(address safe, uint48 key) external view returns (address delegate, uint48 prev, uint48 next);
    function getTokenAllowance(address safe, address delegate, address token)
        external
        view
        returns (uint256[5] memory);
    function getDelegates(address safe, uint48 start, uint8 pageSize)
        external
        view
        returns (address[] memory results, uint48 next);
    function getTokens(address safe, address delegate) external view returns (address[] memory);
}

/// The signing page's Safe flows as the exact bytes the page sends for one chain
/// (forge/fixtures/signing-page-<cluster>.json, kept equal to the page's builders and build values by
/// test/web-evm.test.ts), run one after another on that chain's real Safe 1.4.1 factory,
/// MultiSendCallOnly, Allowance Module and USDG.
abstract contract SigningPageFlows {
    PageVm internal constant vm = PageVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address private constant MULTI_SEND_CALL_ONLY = 0x9641d764fc13c8B624c04430C7356C1C7C8102e2;
    // safe-global/safe-deployments v1.4.1, multi_send_call_only.json.
    bytes32 private constant MULTI_SEND_CALL_ONLY_CODE_HASH =
        0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939;

    string private fixture;
    address private owner;
    address private hot;
    address private usd;
    PageModule private module;
    PageSafe private safe;

    /// The fork's RPC and the fixture for its cluster.
    function chain() internal view virtual returns (string memory rpc, string memory cluster);

    function setUp() public {
        (string memory rpc, string memory cluster) = chain();
        vm.createSelectFork(rpc);
        fixture = vm.readFile(string.concat("forge/fixtures/signing-page-", cluster, ".json"));
        require(block.chainid == vm.parseJsonUint(fixture, ".chainId"), "the RPC serves another chain");
        owner = vm.parseJsonAddress(fixture, ".owner");
        hot = vm.parseJsonAddress(fixture, ".hot");
        usd = vm.parseJsonAddress(fixture, ".usd");
        module = PageModule(vm.parseJsonAddress(fixture, ".module"));
        safe = PageSafe(vm.parseJsonAddress(fixture, ".safe"));
        require(usd.code.length > 0, "no USDG at the fixture's address");
        require(address(module).code.length > 0, "no Allowance Module at the fixture's address");
    }

    function test_multiSendCallOnlyIsTheCanonicalCode() public view {
        require(MULTI_SEND_CALL_ONLY.codehash == MULTI_SEND_CALL_ONLY_CODE_HASH, "MultiSendCallOnly is not 1.4.1");
    }

    function test_createEnableKillAndEnableAgain() public {
        create();
        send(owner, address(safe), "enable");
        requireAllowance(vm.parseJsonUint(fixture, ".cap"));
        requireProofView(true);

        send(owner, address(safe), "kill");
        require(listed() == address(0), "the hot wallet is still a delegate after the kill");
        requireProofView(false);
        require(module.getTokenAllowance(address(safe), hot, usd)[0] == 0, "the allowance survived the kill");

        // After a kill the module is still on, so the page leaves enableModule out.
        send(owner, address(safe), "reenable");
        requireAllowance(vm.parseJsonUint(fixture, ".cap"));
    }

    /// The pre-validated signature is good only from the owner: the same bytes from anyone else revert.
    function test_safeCallsFromAnotherSenderRevert() public {
        create();
        require(!sends(address(0xBAD), address(safe), "enable"), "the Safe ran the enable for a stranger");
        require(!safe.isModuleEnabled(address(module)), "a refused enable changed the Safe");
        send(owner, address(safe), "enable");
        require(!sends(address(0xBAD), address(safe), "kill"), "the Safe ran the kill for a stranger");
        require(listed() == hot, "a refused kill changed the delegate");
    }

    /// The Safe at the fixture's address, from the page's create. Every later call goes there, and a
    /// call to an address with no code would succeed doing nothing, so this check comes first.
    function create() private {
        address created = abi.decode(send(owner, PROXY_FACTORY, "create"), (address));
        require(
            created == address(safe),
            string.concat("the page's create made a Safe at ", vm.toString(created), ", not the fixture's")
        );
        address[] memory owners = safe.getOwners();
        require(owners.length == 1 && owners[0] == owner && safe.getThreshold() == 1, "not the owner's 1-of-1 Safe");
    }

    /// What the proof page reads to list every spending right: the enabled modules, the module's
    /// delegates and each delegate's tokens.
    function requireProofView(bool delegated) private view {
        (address[] memory modules,) = safe.getModulesPaginated(address(1), 20);
        require(modules.length == 1 && modules[0] == address(module), "the Safe's modules are not just the Allowance Module");
        (address[] memory delegates,) = module.getDelegates(address(safe), 0, 50);
        if (!delegated) {
            require(delegates.length == 0, "the module still lists a delegate after the kill");
            return;
        }
        require(delegates.length == 1 && delegates[0] == hot, "the module's delegates are not just the hot wallet");
        address[] memory tokens = module.getTokens(address(safe), hot);
        require(tokens.length == 1 && tokens[0] == usd, "the hot wallet's tokens are not just USDG");
    }

    function requireAllowance(uint256 cap) private view {
        require(safe.isModuleEnabled(address(module)), "the module is not enabled");
        require(listed() == hot, "the hot wallet is not a delegate");
        uint256[5] memory allowance = module.getTokenAllowance(address(safe), hot, usd);
        require(allowance[0] == cap && allowance[2] == 1440, "the allowance is not the page's cap per day");
    }

    function listed() private view returns (address delegate) {
        (delegate,,) = module.delegates(address(safe), uint48(uint160(hot)));
    }

    function send(address from, address to, string memory key) private returns (bytes memory result) {
        bool ok;
        bytes memory data = vm.parseJsonBytes(fixture, string.concat(".", key));
        vm.prank(from);
        (ok, result) = to.call(data);
        require(ok, string.concat("the page's ", key, " reverted"));
    }

    function sends(address from, address to, string memory key) private returns (bool ok) {
        bytes memory data = vm.parseJsonBytes(fixture, string.concat(".", key));
        vm.prank(from);
        (ok,) = to.call(data);
    }
}

contract SigningPageTestnetTest is SigningPageFlows {
    function chain() internal view override returns (string memory, string memory) {
        return (vm.envOr("ROBINHOOD_TESTNET_RPC_URL", string("https://rpc.testnet.chain.robinhood.com")), "robinhood-testnet");
    }
}

/// The mainnet pilot's Safe, enabled and killed before the owner signs any of it for real.
contract SigningPageMainnetTest is SigningPageFlows {
    function chain() internal view override returns (string memory, string memory) {
        return (vm.envOr("ROBINHOOD_MAINNET_RPC_URL", string("https://rpc.mainnet.chain.robinhood.com")), "robinhood");
    }
}
