import path from 'path'
import PaymentProcessor from '../../src/payment/paymentProcessor'
import * as Normalizer from '../../src/utils/normalizer'
import { UserReference } from '../../src/models/userReference'
import nock from 'nock'
import { User } from '../../src/models/user'
const lockAddress = '0xf5D0C1cfE659902F9ABAE67A70d5923Ef8dbC1Dc'
const stripeToken = 'sk_test_token'
const mockVisaToken = 'tok_visa'
const nockBack = nock.back
import { vi } from 'vitest'

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        customers: {
          create: vi
            .fn()
            .mockResolvedValueOnce({ id: 'a valid customer id' })
            .mockRejectedValueOnce(new Error('unknown token')),
          createSource: vi.fn(),
        },
        charges: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              status: 'succeeded',
            })
            .mockRejectedValueOnce('An error in purchase'),
        },
      }
    }),
  }
})

// eslint-disable-next-line
var mockDispatcher = { purchase: vi.fn() }

vi.mock('../../src/fulfillment/dispatcher', () => {
  const mocked = vi.fn().mockImplementation(() => {
    return mockDispatcher
  })
  return {
    default: mocked,
  }
})

vi.mock('../../src/utils/keyPricer', () => {
  const mockedKeyPricer = vi.fn().mockImplementation(() => {
    return {
      generate: vi.fn().mockReturnValue({
        keyPrice: 10,
        gasFee: 5,
        creditCardProcessing: 100,
        unlockServiceFee: 70,
      }),
      keyPriceUSD: vi.fn().mockResolvedValue(42),
    }
  })
  return {
    default: mockedKeyPricer,
  }
})

describe('PaymentProcessor', () => {
  let paymentProcessor: PaymentProcessor

  beforeAll(async () => {
    nockBack.fixtures = path.join(
      __dirname,
      '..',
      'fixtures',
      'paymentProcessor'
    )
    nockBack.setMode('lockdown')

    const { nockDone } = await nockBack('setup.json')
    paymentProcessor = new PaymentProcessor()

    await User.truncate({ cascade: true })
    await UserReference.create(
      {
        emailAddress: Normalizer.emailAddress('foo2@example.com'),
        stripe_customer_id: 'a valid customer id',
        // @ts-expect-error - Sequelize type does not support creating a relationship item in the create yet. This is a bug in Sequelize types.
        User: {
          publicKey: Normalizer.ethereumAddress(
            '0xC66Ef2E0D0eDCce723b3fdd4307db6c5F0Dda1b8'
          ),
          recoveryPhrase: 'a recovery phrase',
          passwordEncryptedPrivateKey: { a: 'blob' },
        },
      },
      {
        include: [User],
      }
    )

    await UserReference.create(
      {
        emailAddress: Normalizer.emailAddress(
          'connected_account_user@example.com'
        ),
        stripe_customer_id: 'cus_H669IyGrYp85kA',
        // @ts-expect-error - Sequelize type does not support creating a relationship item in the create yet. This is a bug in Sequelize types.
        User: {
          publicKey: Normalizer.ethereumAddress(
            '0x9409bD2F87F0698f89C04cAeE8DdB2fD9e44bCc3'
          ),
          recoveryPhrase: 'a recovery phrase',
          passwordEncryptedPrivateKey: "{ a: 'blob' }",
        },
      },
      {
        include: [User],
      }
    )

    await UserReference.create(
      {
        emailAddress: Normalizer.emailAddress(
          'user_without_payment_details@example.com'
        ),
        // @ts-expect-error - Sequelize type does not support creating a relationship item in the create yet. This is a bug in Sequelize types.
        User: {
          publicKey: Normalizer.ethereumAddress(
            '0xeF49773e0D59F607ceA8c8bE4Ce87bd26Fd8E208'
          ),
          recoveryPhrase: 'a recovery phrase',
          passwordEncryptedPrivateKey: "{ a: 'blob' }",
        },
      },
      {
        include: [User],
      }
    )

    nockDone()
  })

  afterAll(() => {
    nock.restore()
  })

  describe('updateUserPaymentDetails', () => {
    describe('when the user can be created', () => {
      it('returns the customer id', async () => {
        expect.assertions(1)
        const user = await paymentProcessor.updateUserPaymentDetails(
          mockVisaToken,
          '0xC66Ef2E0D0eDCce723b3fdd4307db6c5F0Dda1b8'
        )

        expect(user).toBe(true)
      })
    })
  })
})
