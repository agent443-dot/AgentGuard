// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface PageVm {
    function createSelectFork(string calldata url) external returns (uint256);
    function envOr(string calldata name, string calldata fallbackValue) external view returns (string memory);
    function readFile(string calldata path) external view returns (string memory);
    function parseJsonAddress(string calldata json, string calldata key) external pure returns (address);
    function parseJsonBytes(string calldata json, string calldata key) external pure returns (bytes memory);
    function prank(address sender) external;
}

interface PageSafe {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        uint256 safeTxGas,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken,
        address payable refundReceiver,
        bytes memory signatures
    ) external payable returns (bool);
}

interface PageFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address);
}

interface PageModule {
    function addDelegate(address delegate) external;
    function setAllowance(address delegate, address token, uint96 amount, uint16 resetTimeMin, uint32 resetBaseMin)
        external;
    function delegates(address safe, uint48 key) external view returns (address delegate, uint48 prev, uint48 next);
    function getTokenAllowance(address safe, address delegate, address token)
        external
        view
        returns (uint256[5] memory);
}

/// The signing page's kill, as the exact bytes it sends (forge/fixtures/signing-page.json, checked
/// against the page's builder by test/web-evm.test.ts), run on Robinhood testnet's real Safe 1.4.1
/// and Allowance Module with the hot wallet set up as guard-core draws on it.
contract SigningPageKillTest {
    PageVm private constant vm = PageVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant SAFE_L2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address private constant PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address private constant USDG = 0x7E955252E15c84f5768B83c41a71F9eba181802F;

    address private owner;
    address private hot;
    PageModule private module;
    bytes private kill;
    PageSafe private safe;

    function setUp() public {
        vm.createSelectFork(vm.envOr("ROBINHOOD_TESTNET_RPC_URL", string("https://rpc.testnet.chain.robinhood.com")));
        string memory fixture = vm.readFile("forge/fixtures/signing-page.json");
        owner = vm.parseJsonAddress(fixture, ".owner");
        hot = vm.parseJsonAddress(fixture, ".hot");
        module = PageModule(vm.parseJsonAddress(fixture, ".module"));
        kill = vm.parseJsonBytes(fixture, ".kill");

        address[] memory owners = new address[](1);
        owners[0] = owner;
        bytes memory init =
            abi.encodeCall(PageSafe.setup, (owners, 1, address(0), "", address(0), address(0), 0, payable(address(0))));
        safe = PageSafe(PageFactory(PROXY_FACTORY).createProxyWithNonce(SAFE_L2, init, block.timestamp));
        asOwner(address(safe), abi.encodeWithSignature("enableModule(address)", address(module)));
        asOwner(address(module), abi.encodeCall(PageModule.addDelegate, (hot)));
        asOwner(address(module), abi.encodeCall(PageModule.setAllowance, (hot, USDG, 50e6, 1440, 0)));
        require(listed() == hot, "the hot wallet is not a delegate before the kill");
    }

    function test_pageKillRemovesTheDelegateAndItsAllowance() public {
        vm.prank(owner);
        (bool ok, bytes memory result) = address(safe).call(kill);
        require(ok && abi.decode(result, (bool)), "the Safe refused the page's kill from its owner");
        require(listed() == address(0), "the hot wallet is still a delegate after the kill");
        require(module.getTokenAllowance(address(safe), hot, USDG)[0] == 0, "the allowance survived the kill");
    }

    /// The pre-validated signature is good only from the owner: the same bytes from anyone else revert.
    function test_pageKillFromAnotherSenderReverts() public {
        vm.prank(address(0xBAD));
        (bool ok,) = address(safe).call(kill);
        require(!ok, "the Safe ran the kill for someone other than its owner");
        require(listed() == hot, "a refused kill changed the delegate");
    }

    function listed() private view returns (address delegate) {
        (delegate,,) = module.delegates(address(safe), uint48(uint160(hot)));
    }

    function asOwner(address to, bytes memory data) private {
        bytes memory signature = abi.encodePacked(uint256(uint160(owner)), uint256(0), uint8(1));
        vm.prank(owner);
        bool ok = safe.execTransaction(to, 0, data, 0, 0, 0, 0, address(0), payable(address(0)), signature);
        require(ok, "safe transaction failed");
    }
}
