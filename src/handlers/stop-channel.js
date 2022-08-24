const AWS = require("aws-sdk");
const ivs = new AWS.IVS();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

const tableName = process.env.CHANNEL_TABLE;
const ivsBucketName = process.env.IVS_BUCKET_NAME;
const liveStopSqsUrl = process.env.LIVE_STOP_SQS_URL;

exports.handler = async (event, context) => {
  console.info('stopChannel received:', event);
  const channelName = event.pathParameters.channelName;

  const dt = new Date();
  const now = dt.toISOString();
  const awsAccountId = context.invokedFunctionArn.split(':')[4]
  let channel;

  const response = {
    statusCode: 200,
    body: "",
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };

  // 채널 정보 가져오기
  try {
    const queryParams = {
      TableName: tableName,
      Key: {
        "channel_name": channelName
      }
    };

    channel = await dynamodb.get(queryParams).promise();
    if (isEmpty(channel)) {
      console.log(channel);
      response.statusCode = 500;
      response.body = channelName + " 채널 정보를 가져오는데 실패했습니다.";
      return response;
    }
  }
  catch (err) {
    console.error('ERROR: IVS getChannel', err);
    response.body = err;
    response.statusCode = 500;
    return response;
  }

  // 스트림 중지
  let streamParams = {
    channelArn: channel.Item.channel_arn
  };

  await ivs.stopStream(streamParams, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      console.log("라이브 스트리밍이 중지 되었습니다.")
    }
  });

  // 채널 삭제
  let params = {
    arn: channel.Item.channel_arn
  };
  await ivs.deleteChannel(params, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    } else {
      response.body = JSON.stringify("라이브 스트리밍이 정상 종료 되었습니다.");
    }
  });

  // 방송 종료 DynamoDB 업데이트 및 SQS에 방송 종료 이벤트 발송
  try {
    const bucketParams = {
      Bucket : ivsBucketName,
      Prefix : 'ivs/v1/' + awsAccountId + '/'+ channel.Item.channel_arn.split("/")[1] + '/'
    };

    const s3List= await s3.listObjectsV2(bucketParams).promise();
    const items = s3List.Contents.filter(item => item.Key.endsWith('jpg'));
    const thumbnail_url = "https://d3cgmkcvd3sd1x.cloudfront.net/" + items[0].Key;
    console.log("https://d3cgmkcvd3sd1x.cloudfront.net/" + items[0].Key);

    let updateParams = {
      ExpressionAttributeValues: {
        ":end_time" : now,
        ":is_live" : false,
        ":thumbnail_url" : thumbnail_url,
        ":channel_type" : "ENCODING"
      },
      Key: {
        "channel_name": channel.Item.channel_name
      },
      ReturnValues: "NONE",
      TableName: tableName,
      UpdateExpression: "SET end_time = :end_time, is_live = :is_live, thumbnail_url = :thumbnail_url, channel_type = :channel_type"
    };
    await dynamodb.update(updateParams).promise();

    const message = {
      channel_id: channel.Item.channel_arn.split("/")[1],
      channel_name: channel.Item.channel_name
    };
    const sendParams = {
      QueueUrl: liveStopSqsUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: 0,
    };

    const msg = await sqs.sendMessage(sendParams).promise();
    console.log("Success", msg);

  } catch (err) {
    console.error('ERROR: IVS stopChannel', err);
    response.statusCode = 500;
    response.body = err.stack;
  }

  console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);

  return response;
};

let isEmpty = function(value) {
  return value == "" || value == null || value == undefined || (value != null && typeof value == "object" && !Object.keys(value).length);
};