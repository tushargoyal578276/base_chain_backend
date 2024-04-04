require('dotenv').config()

module.exports = {
  deployments: {
    netId97: {
      instanceAddress: {
        'any':'0x7AECc9363018daF17Cde1E3DbfA60b72fD5586D6'
      },
      symbol: 'BNB',
      decimals: 18
    },
    netId5: {
      instanceAddress: {
        'any':'0xf231Be68BAab095eF42Ab6BF833cFda68D175224'
      },
      symbol: 'ETH',
      decimals: 18
    },
    netId56: {
      instanceAddress: {
        'any':'0x58A0851F5619630b0c7136fB6CD62063949986d0'
      },
      symbol: 'BNB',
      decimals: 18
    }
  }
}
