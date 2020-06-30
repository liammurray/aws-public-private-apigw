# Overview

## Dependencies

Install dev requirements (e.g. pytest, etc.) to run tests, etc.

```bash
pip install -r requirements-dev.txt
```

There is a `requirements.txt` file in `./code`. This is for dependencies that are packaged with the lambdas. Basically add anything that is not in a layer or provided with the system.

If you install new dependencies save them.

```bash
pip freeze --exclude-editable --local > requirements.txt
```

## Run unit tests

```bash
pytest
# See print statements and verbose output
pytest -vs
```

## More testing info

Run all tests:

```bash
pytest
```

See print statements:

```bash
pytest -s
```

See verbose output:

```bash
pytest -v
```

To run one test (pass pattern, in this case test function name):

```bash
pytest -vs -k "test_startAutomationCommand"
```

To run tests in file

```bash
pytest -vs -k sometest.py
```

See [pytest docs](https://docs.pytest.org/en/latest/usage.html) for more

## Stubs

You can declare a fixture to define a fixed response. The following just returns a string so is a bit contrived. It behaves like Mocha 'before' returning a value.

```python
@pytest.fixture()
def ssm_param_response():
  # A bit contrived. This is like Mocha 'before' returning a value.
  return 'my_ami'
```

You can add things to stub by using `@mock.patch`. Note weird way we have to add params in reverse order. After mocks you can pass fixtures. For example:

```python
@mock.patch('my.package.getSsmParam')
@mock.patch('boto3.client')
def test_ssm_create_ami(client, getSsmParam, ssm_param_response):
  # Simple stub constant return value
  getSsmParam.return_value = ssm_param_response
  # etc.
```

To stub using function:

```python

def fakeGetSsmParam(path, is_json=True, is_encrypted=True):
  return 'foo'


getSsmParam.side_effect = fakeGetSsmParam
```

To stub series of responses (for each subsequent call)

```python

getSsmParam.side_effect = ['first', 'second', 'third']
```
