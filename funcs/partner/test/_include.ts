import chai from 'chai'
import sinonChai from 'sinon-chai'

chai.use(sinonChai)

chai.config.includeStack = true

process.env.SERVICE_NAME = 'testService'
process.env.AWS_REGION = 'us-west-2'
