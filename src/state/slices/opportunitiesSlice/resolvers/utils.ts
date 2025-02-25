import type { DefiProvider, DefiType } from 'features/defi/contexts/DefiManagerProvider/DefiCommon'
import pipe from 'lodash/flow'

import {
  DefiProviderToMetadataResolverByDeFiType,
  DefiProviderToUserDataResolverByDeFiType,
} from '.'

// "Give me the resolvers for a given DeFi provider"
export const getDefiProviderMetadataResolvers = (defiProvider: DefiProvider) =>
  DefiProviderToMetadataResolverByDeFiType[defiProvider]
// "Give me the resolvers for a given DeFi type"
export const getDefiTypeMetadataResolvers = (
  defiType: DefiType,
  resolversByType: ReturnType<typeof getDefiProviderMetadataResolvers>,
) => resolversByType?.[defiType]

export const getMetadataResolversByDefiProviderAndDefiType = (
  defiProvider: DefiProvider,
  defiType: DefiType,
) =>
  pipe(
    getDefiProviderMetadataResolvers,
    getDefiTypeMetadataResolvers.bind(this, defiType),
  )(defiProvider)

// "Give me the resolvers for a given DeFi provider"
export const getDefiProviderUserDataResolvers = (defiProvider: DefiProvider) =>
  DefiProviderToUserDataResolverByDeFiType[defiProvider]
// "Give me the resolvers for a given DeFi type"
export const getDefiTypeUserDataResolvers = (
  defiType: DefiType,
  resolversByType: ReturnType<typeof getDefiProviderUserDataResolvers>,
) => resolversByType?.[defiType]

export const getUserDataResolversByDefiProviderAndDefiType = (
  defiProvider: DefiProvider,
  defiType: DefiType,
) =>
  pipe(
    getDefiProviderUserDataResolvers,
    getDefiTypeUserDataResolvers.bind(this, defiType),
  )(defiProvider)
