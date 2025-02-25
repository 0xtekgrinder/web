import type { AssetId } from '@shapeshiftoss/caip'
import { ethAssetId, foxAssetId } from '@shapeshiftoss/caip'
import { DefiProvider, DefiType } from 'features/defi/contexts/DefiManagerProvider/DefiCommon'
import { clearState, store } from 'state/store'

import { foxEthLpAssetId } from './constants'
import {
  fauxmesAccountId,
  gomesAccountId,
  mockLpContractOne,
  mockStakingContractOne,
} from './mocks'
import { initialState, opportunities } from './opportunitiesSlice'
import type { GetOpportunityMetadataOutput, GetOpportunityUserDataOutput } from './types'
import { serializeUserStakingId } from './utils'

describe('opportunitiesSlice', () => {
  beforeEach(() => {
    clearState()
  })

  it('returns uninitialized properties for initialState', async () => {
    expect(store.getState().opportunities).toEqual(initialState)
  })

  describe('reducers', () => {
    beforeEach(() => {
      store.dispatch(opportunities.actions.clear())
    })
    describe('clear', () => {
      it.todo('clears state back to initial state')
    })
    describe('upsertOpportunityMetadata', () => {
      it('inserts metadata', () => {
        const payload: GetOpportunityMetadataOutput = {
          byId: {
            'eip155:1:0xMyContract': {
              // The LP token AssetId
              assetId: foxEthLpAssetId,
              provider: DefiProvider.FoxEthLP,
              tvl: '424242',
              apy: '0.42',
              type: DefiType.LiquidityPool,
              underlyingAssetIds: [foxAssetId, ethAssetId] as [AssetId, AssetId],
              underlyingAssetRatios: ['5000000000000000', '202200000000000000000'] as [
                string,
                string,
              ],
            },
          },
          type: DefiType.LiquidityPool,
        }
        const expected = {
          'eip155:1:0xMyContract': {
            apy: '0.42',
            assetId: foxEthLpAssetId,
            provider: DefiProvider.FoxEthLP,
            tvl: '424242',
            type: DefiType.LiquidityPool,
            underlyingAssetIds: [foxAssetId, ethAssetId],
            underlyingAssetRatios: ['5000000000000000', '202200000000000000000'],
          },
        }
        store.dispatch(opportunities.actions.upsertOpportunityMetadata(payload))
        expect(store.getState().opportunities.lp.byId).toEqual(expected)
      })
    })
    describe('upsertOpportunityAccounts', () => {
      it('inserts an LpId for a tuple of a single AccountId - empty byAccountId', () => {
        const payload: GetOpportunityUserDataOutput = {
          byAccountId: {
            [gomesAccountId]: [mockLpContractOne],
          },
          type: DefiType.LiquidityPool,
        }

        store.dispatch(opportunities.actions.upsertOpportunityAccounts(payload))
        expect(store.getState().opportunities.lp.byAccountId).toEqual(payload.byAccountId)
      })
      it('inserts a StakingId for a tuple of a single AccountId - empty byAccountId', () => {
        const payload: GetOpportunityUserDataOutput = {
          byAccountId: {
            [gomesAccountId]: [mockStakingContractOne],
          },
          type: DefiType.Staking,
        }

        store.dispatch(opportunities.actions.upsertOpportunityAccounts(payload))
        expect(store.getState().opportunities.staking.byAccountId).toEqual(payload.byAccountId)
      })

      it('inserts an LpId for a tuple of a single AccountId - merges prevState and payload byAccountId', () => {
        const insertPayload: GetOpportunityUserDataOutput = {
          byAccountId: {
            [gomesAccountId]: [mockLpContractOne],
          },
          type: DefiType.LiquidityPool,
        }

        store.dispatch(opportunities.actions.upsertOpportunityAccounts(insertPayload))
        expect(store.getState().opportunities.lp.byAccountId).toEqual(insertPayload.byAccountId)

        const upsertPayload: GetOpportunityUserDataOutput = {
          byAccountId: {
            [fauxmesAccountId]: [mockLpContractOne],
          },
          type: DefiType.LiquidityPool,
        }

        const expected = {
          [gomesAccountId]: [mockLpContractOne],
          [fauxmesAccountId]: [mockLpContractOne],
        }
        store.dispatch(opportunities.actions.upsertOpportunityAccounts(upsertPayload))
        expect(store.getState().opportunities.lp.byAccountId).toEqual(expected)
      })
      it('inserts an StakingId for a tuple of a single AccountId - merges prevState and payload byAccountId', () => {
        const insertPayload: GetOpportunityUserDataOutput = {
          byAccountId: {
            [gomesAccountId]: [mockStakingContractOne],
          },
          type: DefiType.Staking,
        }

        store.dispatch(opportunities.actions.upsertOpportunityAccounts(insertPayload))
        expect(store.getState().opportunities.staking.byAccountId).toEqual(
          insertPayload.byAccountId,
        )

        const upsertPayload: GetOpportunityUserDataOutput = {
          byAccountId: {
            [fauxmesAccountId]: [mockStakingContractOne],
          },
          type: DefiType.Staking,
        }

        const expected = {
          [gomesAccountId]: [mockStakingContractOne],
          [fauxmesAccountId]: [mockStakingContractOne],
        }
        store.dispatch(opportunities.actions.upsertOpportunityAccounts(upsertPayload))
        expect(store.getState().opportunities.staking.byAccountId).toEqual(expected)
      })
    })

    describe('upsertUserStakingOpportunities', () => {
      it('inserts user data', () => {
        const payload = {
          [serializeUserStakingId(gomesAccountId, 'eip155:1:0xMyStakingContract')]: {
            stakedAmountCryptoPrecision: '42000',
            rewardsAmountCryptoPrecision: '42',
          },
        }
        store.dispatch(opportunities.actions.upsertUserStakingOpportunities(payload))
        expect(store.getState().opportunities.userStaking.byId).toEqual(payload)
        expect(store.getState().opportunities.userStaking.ids).toEqual(Object.keys(payload))
      })
    })
  })
})
