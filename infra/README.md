# infra

Deploys VPC, private API and public API in three stacks.

## Build lambdas

```bash
cd ../funcs
make clean lambda
```

## VPC

```bash
npm run cdk deploy PrivateDemoVpc
```

## Private API

```bash
npm run cdk deploy PrivateDemoPrivateApi
```

### Test Private API

Assuming private DNS is disabled you can use URL that has API ID and VPCE ID in the url. This wasy you don't have to pass API ID in a header.

```bash
curl -kv https://azfm8lf4d4-vpce-04f89e17e5d351d8e.execute-api.us-west-2.amazonaws.com/active/v1/echo
```

### Troubleshoot Private API

Resource policy should allow "execute-api:Invoke" from source VPC (attached to endpoint) for any principal

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-authorization-flow.html

API GW should show `vpce-04f89e17e5d351d8e` (endpoint id) or similar in settings. Once associated you can use URL with api id in the name.
This means you don't need to pass API ID in host header.

https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-private-apis.html#associate-private-api-with-vpc-endpoint

## Public API

```bash
npm run cdk deploy PrivateDemoPublicApi
```
