import { useToast } from '@chakra-ui/react'
import type { AccountId } from '@shapeshiftoss/caip'
import { toAssetId } from '@shapeshiftoss/caip'
import type { DepositValues } from 'features/defi/components/Deposit/Deposit'
import { Deposit as ReusableDeposit, Field } from 'features/defi/components/Deposit/Deposit'
import type {
  DefiParams,
  DefiQueryParams,
} from 'features/defi/contexts/DefiManagerProvider/DefiCommon'
import { DefiStep } from 'features/defi/contexts/DefiManagerProvider/DefiCommon'
import { getFormFees } from 'plugins/cosmos/utils'
import { useCallback, useContext, useMemo } from 'react'
import type { UseFormSetValue } from 'react-hook-form'
import { useTranslate } from 'react-polyglot'
import { useHistory } from 'react-router-dom'
import type { AccountDropdownProps } from 'components/AccountDropdown/AccountDropdown'
import type { StepComponentProps } from 'components/DeFi/components/Steps'
import { estimateFees } from 'components/Modals/Send/utils'
import { useBrowserRouter } from 'hooks/useBrowserRouter/useBrowserRouter'
import { BigNumber, bn, bnOrZero } from 'lib/bignumber/bignumber'
import { logger } from 'lib/logger'
import { toBaseUnit } from 'lib/math'
import {
  selectAssetById,
  selectMarketDataById,
  selectPortfolioCryptoBalanceByFilter,
} from 'state/slices/selectors'
import { useAppSelector } from 'state/store'
import type { Nullable } from 'types/common'

import { CosmosDepositActionType } from '../DepositCommon'
import { DepositContext } from '../DepositContext'

const moduleLogger = logger.child({ namespace: ['CosmosDeposit:Deposit'] })

type DepositProps = StepComponentProps & {
  accountId: Nullable<AccountId>
  onAccountIdChange: AccountDropdownProps['onChange']
}

export const Deposit: React.FC<DepositProps> = ({
  onNext,
  accountId,
  onAccountIdChange: handleAccountIdChange,
}) => {
  const { state, dispatch } = useContext(DepositContext)
  const history = useHistory()
  const translate = useTranslate()
  const { query } = useBrowserRouter<DefiQueryParams, DefiParams>()
  const { chainId, assetReference } = query
  const assetNamespace = 'slip44'
  const assetId = toAssetId({ chainId, assetNamespace, assetReference })

  const asset = useAppSelector(state => selectAssetById(state, assetId))
  const marketData = useAppSelector(state => selectMarketDataById(state, assetId))

  const opportunity = useMemo(() => state?.cosmosOpportunity, [state])

  // user info
  const filter = useMemo(() => ({ assetId, accountId: accountId ?? '' }), [assetId, accountId])
  const balance = useAppSelector(state => selectPortfolioCryptoBalanceByFilter(state, filter))

  // notify
  const toast = useToast()

  const cryptoAmountAvailable = useMemo(
    () => bnOrZero(balance).div(`1e${asset.precision}`),
    [asset.precision, balance],
  )
  const fiatAmountAvailable = useMemo(
    () => bnOrZero(cryptoAmountAvailable).times(marketData.price),
    [cryptoAmountAvailable, marketData.price],
  )

  const handleMaxClick = useCallback(
    async (setValue: UseFormSetValue<DepositValues>) => {
      if (!accountId) return
      const estimatedFees = await estimateFees({
        cryptoAmount: cryptoAmountAvailable.toString(),
        asset,
        address: '',
        sendMax: true,
        accountId,
        contractAddress: '',
      })
      const amountAvailableCryptoPrecision = toBaseUnit(cryptoAmountAvailable, asset.precision)
      const cryptoAmountHuman = bnOrZero(amountAvailableCryptoPrecision)
        .minus(estimatedFees.average.txFee)
        .div(bn(10).pow(asset.precision))
        .toString()
      const fiatAmount = bnOrZero(cryptoAmountHuman).times(marketData.price)
      setValue(Field.FiatAmount, fiatAmount.toString(), {
        shouldValidate: true,
      })
      setValue(Field.CryptoAmount, cryptoAmountHuman.toString(), {
        shouldValidate: true,
      })
    },
    [accountId, asset, cryptoAmountAvailable, marketData.price],
  )

  const handleContinue = useCallback(
    async (formValues: DepositValues) => {
      if (!(state && dispatch && state.userAddress)) return

      const getStakingGasEstimate = async () => {
        if (!state.userAddress || !assetReference) return

        const { gasLimit, gasPrice } = await getFormFees(asset, marketData.price)

        try {
          return bnOrZero(gasPrice).times(gasLimit).toFixed(0)
        } catch (error) {
          moduleLogger.error(
            { fn: 'getStakingGasEstimate', error },
            'Error getting deposit gas estimate',
          )
          toast({
            position: 'top-right',
            description: translate('common.somethingWentWrongBody'),
            title: translate('common.somethingWentWrong'),
            status: 'error',
          })
        }
      }

      // set deposit state for future use
      dispatch({ type: CosmosDepositActionType.SET_DEPOSIT, payload: formValues })
      dispatch({ type: CosmosDepositActionType.SET_LOADING, payload: true })
      try {
        const estimatedGasCrypto = await getStakingGasEstimate()
        if (!estimatedGasCrypto) return
        dispatch({
          type: CosmosDepositActionType.SET_DEPOSIT,
          payload: { estimatedGasCrypto },
        })
        onNext(DefiStep.Confirm)
        dispatch({ type: CosmosDepositActionType.SET_LOADING, payload: false })
      } catch (error) {
        moduleLogger.error({ fn: 'handleContinue', error }, 'Error on continue')
        toast({
          position: 'top-right',
          description: translate('common.somethingWentWrongBody'),
          title: translate('common.somethingWentWrong'),
          status: 'error',
        })
        dispatch({ type: CosmosDepositActionType.SET_LOADING, payload: false })
      }
    },
    [asset, assetReference, dispatch, marketData.price, onNext, state, toast, translate],
  )

  if (!state || !dispatch) return null

  const handleCancel = history.goBack

  const validateCryptoAmount = (value: string) => {
    const crypto = bnOrZero(balance).div(`1e+${asset.precision}`)
    const _value = bnOrZero(value)
    const hasValidBalance = crypto.gt(0) && _value.gt(0) && crypto.gte(value)
    if (_value.isEqualTo(0)) return ''
    return hasValidBalance || 'common.insufficientFunds'
  }

  const validateFiatAmount = (value: string) => {
    const crypto = bnOrZero(balance).div(`1e+${asset.precision}`)
    const fiat = crypto.times(marketData.price)
    const _value = bnOrZero(value)
    const hasValidBalance = fiat.gt(0) && _value.gt(0) && fiat.gte(value)
    if (_value.isEqualTo(0)) return ''
    return hasValidBalance || 'common.insufficientFunds'
  }

  return (
    <ReusableDeposit
      accountId={accountId}
      onAccountIdChange={handleAccountIdChange}
      asset={asset}
      isLoading={state.loading}
      apy={String(opportunity?.apr)}
      cryptoAmountAvailable={cryptoAmountAvailable.toPrecision()}
      cryptoInputValidation={{
        required: true,
        validate: { validateCryptoAmount },
      }}
      fiatAmountAvailable={fiatAmountAvailable.toFixed(2, BigNumber.ROUND_DOWN)}
      fiatInputValidation={{
        required: true,
        validate: { validateFiatAmount },
      }}
      marketData={marketData}
      onCancel={handleCancel}
      onContinue={handleContinue}
      onMaxClick={handleMaxClick}
      percentOptions={[0.25, 0.5, 0.75, 1]}
      enableSlippage={false}
    />
  )
}
