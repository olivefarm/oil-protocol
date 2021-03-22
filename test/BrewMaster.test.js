const { expectRevert, time } = require('@openzeppelin/test-helpers');
const OLIVOil = artifacts.require('OLIVOil');
const BrewMaster = artifacts.require('BrewMaster');
const MockERC20 = artifacts.require('MockERC20');

contract('BrewMaster', ([alice, bob, carol, minter]) => {
    context('With ERC/LP token added to the field', () => {
        beforeEach(async () => {
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });
            this.lp2 = await MockERC20.new('LPToken2', 'LP2', '10000000000', { from: minter });
            await this.lp2.transfer(alice, '1000', { from: minter });
            await this.lp2.transfer(bob, '1000', { from: minter });
            await this.lp2.transfer(carol, '1000', { from: minter });
        });

        it('should allow emergency withdraw', async () => {
            // 100 per block farming rate starting at block 100 with bonus until block 1000
            this.testBrewerMaster = await BrewMaster.new('0x0000000000000000000000000000000000000000', '100', '0', { from: alice });
            await this.testBrewerMaster.add('100', this.lp.address, true);
            await expectRevert(
                this.testBrewerMaster.add('100', this.lp.address, true, { from: bob }),
                'Ownable: caller is not the owner',
            );
            await this.lp.approve(this.testBrewerMaster.address, '1000', { from: bob });
            await this.testBrewerMaster.deposit(0, '100', { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '900');
            await this.testBrewerMaster.emergencyWithdraw(0, { from: bob });
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });

        it('should give Tickets only after farming time', async () => {
            // start at block 100.
            this.testBrewerMaster = await BrewMaster.new('0x0000000000000000000000000000000000000000', '100', '100', { from: alice });
            await this.testBrewerMaster.add('100', this.lp.address, true);
            await this.lp.approve(this.testBrewerMaster.address, '1000', { from: bob });
            await this.testBrewerMaster.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('89');
            await this.testBrewerMaster.deposit(0, '0', { from: bob }); // block 90
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('94');
            await this.testBrewerMaster.deposit(0, '0', { from: bob }); // block 95
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('99');
            await this.testBrewerMaster.deposit(0, '0', { from: bob }); // block 100
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('100');
            await this.testBrewerMaster.deposit(0, '0', { from: bob }); // block 101
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '100');
            await time.advanceBlockTo('104');
            await this.testBrewerMaster.deposit(0, '0', { from: bob }); // block 105
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '500');
        });

        it('should not distribute Tickets if no one deposit', async () => {
            this.testBrewerMaster = await BrewMaster.new('0x0000000000000000000000000000000000000000', '100', '200', { from: alice });
            await this.testBrewerMaster.add('100', this.lp.address, true);
            await this.lp.approve(this.testBrewerMaster.address, '1000', { from: bob });
            await time.advanceBlockTo('199');
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('204');
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '0');
            await time.advanceBlockTo('209');
            await this.testBrewerMaster.deposit(0, '10', { from: bob }); // block 210
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '0');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '990');
            await time.advanceBlockTo('219');
            await this.testBrewerMaster.withdraw(0, '10', { from: bob }); // block 220
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
        });

        it('should distribute Tickets properly for each staker', async () => {
            // 100 per block farming rate starting at block 300 with bonus until block 1000
            this.testBrewerMaster = await BrewMaster.new('0x0000000000000000000000000000000000000000', '100', '300', { from: alice });
            await this.testBrewerMaster.add('100', this.lp.address, true);
            await this.lp.approve(this.testBrewerMaster.address, '1000', { from: alice });
            await this.lp.approve(this.testBrewerMaster.address, '1000', { from: bob });
            await this.lp.approve(this.testBrewerMaster.address, '1000', { from: carol });
            // Alice deposits 10 LPs at block 310
            await time.advanceBlockTo('309');
            await this.testBrewerMaster.deposit(0, '10', { from: alice });
            // Bob deposits 20 LPs at block 314
            await time.advanceBlockTo('313');
            await this.testBrewerMaster.deposit(0, '20', { from: bob });
            // Carol deposits 30 LPs at block 354
            await time.advanceBlockTo('353');
            await this.testBrewerMaster.deposit(0, '30', { from: carol });
            // Alice deposits 10 more LPs at block 374. At this point:
            //   Alice should have: 4*100 + 40*1/3*100 + 20*1/6*100 = 2066
            await time.advanceBlockTo('373')
            await this.testBrewerMaster.deposit(0, '10', { from: alice });
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(alice)).valueOf(), '2066');
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '0');
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(carol)).valueOf(), '0');
            // Bob withdraws 5 LPs at block 330. At this point:
            //   Bob should have: 40*2/3*100 + 20*2/6*100 + 10*2/7*100 = 3619
            await time.advanceBlockTo('383')
            await this.testBrewerMaster.withdraw(0, '5', { from: bob });
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(alice)).valueOf(), '2066');
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '3619');
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(carol)).valueOf(), '0');
            // Alice withdraws 20 LPs at block 410.
            // Bob withdraws 15 LPs at block 414.
            // Carol withdraws 30 LPs at block 454.
            await time.advanceBlockTo('409')
            await this.testBrewerMaster.withdraw(0, '20', { from: alice });
            await time.advanceBlockTo('413')
            await this.testBrewerMaster.withdraw(0, '15', { from: bob });
            await time.advanceBlockTo('453')
            await this.testBrewerMaster.withdraw(0, '30', { from: carol });
            // Alice should have: 4*100 + 40*1/3*100 + 20*1/6*100 + 10*2/7*100 + 26*2/6.5*100 = 3152
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(alice)).valueOf(), '3152');
            // Bob should have: 40*2/3*100 + 20*2/6*100 + 10*2/7*100 + 26*1.5/6.5 * 100 + 4*1.5/4.5*100 = 4352
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(bob)).valueOf(), '4352');
            // Carol should have: 20*3/6*100 + 10*3/7*100 + 26*3/6.5*100 + 4*3/4.5*100 + 40*100 = 6896
            assert.equal((await this.testBrewerMaster.ticketBalanceOf(carol)).valueOf(), '6896');
            // All of them should have 1000 LPs back.
            assert.equal((await this.lp.balanceOf(alice)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(bob)).valueOf(), '1000');
            assert.equal((await this.lp.balanceOf(carol)).valueOf(), '1000');
        });
    });
});