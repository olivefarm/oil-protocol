const { expectRevert, time } = require('@openzeppelin/test-helpers');
const GRAPWine = artifacts.require('GRAPWine');
const BrewMaster = artifacts.require('BrewMaster');
const MockERC20 = artifacts.require('MockERC20');

contract('GRAPWine', ([alice, bob, carol, minter]) => {
    context('With GRAPWine', () => {
        beforeEach(async () => {
            this.grapWine = await GRAPWine.new('0xa5409ec958c83c3f309868babaca7c86dcb077c1', { from: alice });
            this.brewMaster = await BrewMaster.new(this.grapWine.address, '100000000000000000000', '0', { from: alice });
            await this.grapWine.addMinter(this.brewMaster.address, { from: alice });
            
            this.lp = await MockERC20.new('LPToken', 'LP', '10000000000', { from: minter });
            await this.lp.transfer(alice, '1000', { from: minter });
            await this.lp.transfer(bob, '1000', { from: minter });
            await this.lp.transfer(carol, '1000', { from: minter });

            await this.brewMaster.add('100', this.lp.address, true);

            const maxAmount = 1000;
            // 0.01 ETH
            const fixedPrice = String(0.01 * 10e18);
            const wid = 1;
            await this.grapWine.create(maxAmount, 0, "", "0x0");
            await this.brewMaster.addWine(wid, maxAmount, fixedPrice);
        });

        it('should draw wine only the tickets more ticketsConsumed', async () => {
            await this.lp.approve(this.brewMaster.address, '1000', { from: bob });
            await time.advanceBlockTo('21');
            await this.brewMaster.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('23');
            await this.brewMaster.deposit(0, '0', { from: bob });
            await time.advanceBlockTo('25');
            assert.equal((await this.brewMaster.ticketBalanceOf(bob)).valueOf(), '200000000000000000000');
            await expectRevert(
                this.brewMaster.draw({ from: bob }),
                'Tickets are not enough.',
            );
            await time.advanceBlockTo('31');
            await this.brewMaster.deposit(0, '0', { from: bob });
            assert.equal((await this.brewMaster.ticketBalanceOf(bob)).valueOf(), '1000000000000000000000');
            await this.brewMaster.draw({ from: bob });
            assert.equal((await this.brewMaster.ticketBalanceOf(bob)).valueOf(), '0');
            await expectRevert(
                this.brewMaster.draw({ from: bob }),
                'Tickets are not enough.',
            );
            assert.equal((await this.brewMaster.userWineBalanceOf(bob, 1)).valueOf(), '1');
            assert.equal((await this.brewMaster.wineBalanceOf(1)).valueOf(), '999');

            let userWine = await this.brewMaster.userUnclaimWine(bob).valueOf();
            assert.equal(userWine[0], '0');
            assert.equal(userWine[1], '1');
        });

        it('should claim wine amount and need pay fee', async () => {
            await this.lp.approve(this.brewMaster.address, '1000', { from: bob });
            await time.advanceBlockTo('45');
            await this.brewMaster.deposit(0, '100', { from: bob });
            await time.advanceBlockTo('55');
            await this.brewMaster.deposit(0, '0', { from: bob });
            await this.brewMaster.draw({ from: bob });

            const claimFee = (await this.brewMaster.claimFee(1, 1)).valueOf();

            await expectRevert(
                this.brewMaster.claim(1, 0, { from: bob }),
                'amount must not zero',
            );

            await expectRevert(
                this.brewMaster.claim(1, 2, { from: bob }),
                'amount is bad',
            );
            await expectRevert(
                this.brewMaster.claim(1, 1, { from: bob }),
                'need payout claim fee',
            );
            await this.brewMaster.claim(1, 1, { from: bob, value: claimFee});
            assert.equal((await this.grapWine.balanceOf(bob, 1)).valueOf(), '1');
        });

        it('should airdrop by owner', async () => {
            await this.lp.approve(this.brewMaster.address, '1000', { from: bob });
            await this.brewMaster.deposit(0, '100', { from: bob });

            await expectRevert(
                this.brewMaster.airDrop({ from: bob }),
                'Ownable: caller is not the owner',
            );

            await this.brewMaster.airDrop({ from: alice });
            assert.equal((await this.brewMaster.userWineBalanceOf(bob, 1)).valueOf(), '1');
            assert.equal((await this.brewMaster.wineBalanceOf(1)).valueOf(), '999');
        });
    });
});