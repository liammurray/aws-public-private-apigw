# PublicPrivateApiDemo

Demonstrates public and private API Gateway

Deploys three stacks:

- VPC with public and isolated private subnets and VPC endpoint (also bastion for testing)
- Private API only accessible from the VPC via VPC endpoint
- Public API

See:

- [deploy instructions](./infra/README.md)
