# infra

Deploys VPC, private API and public API in three stacks.

## See outputs and exports

You can see stack outputs and exports using the following commands

```bash
aws cloudformation describe-stacks --stack-name PrivateDemoVpc | jq '.Stacks[].Outputs'
```

The following shows the same but via a Python script. Slightly better output and it can be modified with greater ease as needed.

```bash
../stack.py info PrivateDemoVpc
```

Exports can be used by other stacks. It creates a dependency.

```typescript
// PrivateDemoPrivateApi-EchoFuncD4A7A728-7HYEJODK8BW2:live
Fn.importValue('PrivateDemoPrivateApi:EchoFuncAliasLive')
```

## Build lambdas

Install dev requirements (at root of project) for tools like pytest, etc.

```bash
mkvirtualenv private_api -p $(which python3)
workon private_api
pip install requirements.txt
```

If you ever add more deps:

```bash
pip freeze --exclude-editable -l > requirements.txt
```

Build lambdas (python and node)

```bash
cd ../funcs
make clean lambda
```

Test

```bash
cd ../funcs/<proj>
make itest
```

## VPC

```bash
npm run cdk deploy PrivateDemoVpc
```

At this point you can try to connect to the bastion over SSM (see outputs for `BastionHostId`).

```bash
../stack.py info PrivateDemoVpc
```

## Private REST API

```bash
npm run cdk deploy PrivateDemoPrivateRestApi
```

### Test Private REST API

In outputs you will see the private API URL (named `ApiVpceUrl`). This is a special form of the API URL that routes via the VPC endpoint. (It Assumes private DNS is disabled.)

```bash
curl -kv https://zzbbsbcjae-vpce-05a4df99f02d32c02.execute-api.us-west-2.amazonaws.com/active/v1/echo

curl -X POST  https://zzbbsbcjae-vpce-05a4df99f02d32c02.execute-api.us-west-2.amazonaws.com/active/v1/partner/message
```

### Troubleshoot Private REST API

Resource policy should allow "execute-api:Invoke" from source VPC (attached to endpoint) for any principal

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-authorization-flow.html

API GW should show `vpce-04f89e17e5d351d8e` (endpoint id) or similar in settings. Once associated you can use URL with api id in the name.
This means you don't need to pass API ID in host header.

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html#associate-private-api-with-vpc-endpoint

## Public REST API

```bash
npm run cdk deploy PrivateDemoPublicRestApi
```

### Test Public REST API

```bash
# Call endpoint that hits private API via lambda connected to isolated subnet
curl https://3aso80og16.execute-api.us-west-2.amazonaws.com/active/v1/echo/api
# Call endpoint that invokes lambda
curl https://3aso80og16.execute-api.us-west-2.amazonaws.com/active/v1/echo/lambda
```

Or use nicer domain name

```bash
curl https://public.nod15c.com/v1/echo/lambda
curl https://public.nod15c.com/v1/echo/api
# Proxied API
curl -s  https://public.nod15c.com/cats/facts | jq
```

## Cleanup

Delete stacks in reverse order since they have Fn.Import dependencies.

You can also go the AWS console and delete the stacks there.

```bash
npm run cdk destroy PrivateDemoPublicRestApi
npm run cdk destroy PrivateDemoPrivateRestApi
npm run cdk destroy PrivateDemoVpc
```
