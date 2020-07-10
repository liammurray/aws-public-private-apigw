import * as cdk from '@aws-cdk/core'
import * as ec2 from '@aws-cdk/aws-ec2'
import { cfnOutput } from '../utils'

export interface VpcStackProps extends cdk.StackProps {
  cidr: string
}

/**
 * VPC that with VCP endpoint that connects to private API Gateway.
 */
export default class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly vpcEndpoint: ec2.VpcEndpoint

  constructor(scope: cdk.Construct, id: string, props: VpcStackProps) {
    super(scope, id, props)

    const cidr = props.cidr

    // Default VPC has public and private in each AZ (plus NAT and IGW)
    // With NAT:0 we get public and isolated privated subnets
    this.vpc = new ec2.Vpc(this, 'MyVpc', {
      cidr,
      maxAzs: 2,
      natGateways: 0,
    })

    // EC2 for SSM
    // Public so we can install dev tools (without NAT)
    const host = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc: this.vpc,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
    })
    cfnOutput(this, 'BastionHostId', host.instanceId)
    cfnOutput(this, 'BastionHostPrivateIp', host.instancePrivateIp)

    // Default is to add to one subnet per AZ (preferring private?)
    // $0.01 per hour per endpoint per AZ (~$7.50 per month) plus a $0.01 fee per GB of data processed
    // Creates security group without rules
    // Attaching API will add from 10.1.0.0/16:443 to it (I think. Somebody does. Maybe based on servcie below.)
    // The endpoint itself gets a DNS name that can be used to address the private API (see endpoint in console).
    this.vpcEndpoint = this.vpc.addInterfaceEndpoint('MyVpcEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      privateDnsEnabled: false,
      // Allow all VPC traffic to endpoint
      open: true,
    })
    cfnOutput(this, 'VpcEndpointId', this.vpcEndpoint.vpcEndpointId)
  }
}
