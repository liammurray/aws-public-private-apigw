# PublicPrivateApiDemo

Demonstrates public and private API Gateway

Deploys three stacks:

- VPC with public and isolated private subnets and VPC endpoint (also bastion for testing)
- Private API only accessible from the VPC via VPC endpoint
- Public API

See:

- [deploy instructions](./infra/README.md)

## Testing IAM access via roles

Setup test roles for assume role. For example in ~/.aws/config:

```ini
[profile private-demo-role-team-demo]
region = us-west-2
role_arn = arn:aws:iam::<account>:role/PublicDemoRoleTeamDemo
source_profile = <profile>

[profile private-demo-role-team-dev]
region = us-west-2
role_arn = arn:aws:iam::<account>:role/PublicDemoRoleTeamDevs
source_profile = <profile>

[profile private-demo-role-team-demo-vanilla]
region = us-west-2
role_arn = arn:aws:iam::<account>:role/PublicDemoRoleTeamDemoVanilla
source_profile = <profile>

[profile private-demo-role-team-dev-vanilla]
region = us-west-2
role_arn = arn:aws:iam::<account>:role/PublicDemoRoleTeamDevsVanilla
source_profile = <profile>

[profile private-demo-role-3]
region = us-west-2
role_arn = arn:aws:iam::<account>:role/PublicDemoRole3
source_profile = <profile>

[profile private-demo-role-generic]
region = us-west-2
role_arn = arn:aws:iam::<account>:role/PublicDemoRoleGeneric
source_profile = <profile>

```

You can then assume each role and use `awscurl` to send requests. Unfortunately 'awscurl' does not support role switching (using `--profile`) so you have to set AWS_SECRET_ACCESS_KEY and AWS_ACCESS_KEY_ID in your environment.

```bash
# --profile <role> doesn't seem to work
awscurl --region us-west-2  --service execute-api https://public.nod15c.com/v1/echo/iam
```

For example, if you set the resource policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["execute-api:Invoke", "execute-api:InvalidateCache"],
      "Resource": "arn:aws:execute-api:us-west-2:<account>:<api-id>/*",
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/Team": "demo"
        }
      }
    }
  ]
}
```

Only a role/principal tagged Team=demo will be able to access the API, and only if the API has authorizer type = IAM. The reason the authorizer is required appears to be because the PrincipalTag can only be evaluated in that context (see [here](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-resource-policies-aws-condition-keys.html)). Also note that ResourceTag is not available for the `execute-api:Invoke` action.
