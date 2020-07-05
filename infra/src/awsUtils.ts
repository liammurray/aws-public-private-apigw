import * as AWS from 'aws-sdk'

export async function getStringParams(...params: string[]): Promise<string[]> {
  const ssm = new AWS.SSM({ apiVersion: '2014-11-06' })
  const proms = params.map(async p => {
    const res = await ssm.getParameter({ Name: p }).promise()
    if (res && res.Parameter && res.Parameter.Value) {
      return res.Parameter.Value
    }
    throw Promise.reject(`Failed to lookup parameter ${p}`)
  })
  return Promise.all(proms)
}

export async function getCallerAccount(): Promise<string> {
  const sts = new AWS.STS({ apiVersion: '2011-06-15' })
  const data = await sts.getCallerIdentity({}).promise()
  if (!data?.Account) {
    throw new Error('Unexpected: missing account')
  }
  return data.Account
}
