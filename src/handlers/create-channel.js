const AWS = require("aws-sdk")
const ivs = new AWS.IVS();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const tableName = process.env.CHANNEL_TABLE;
const ivsRecordConfArn = process.env.IVS_RECORD_CONF_ARN;

exports.handler = async (event, context) => {
    console.info('createChannel received:', event);

    let channelName;
    let params;

    const dt = new Date();
    const formatted =dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate()+'-'+dt.getHours()+dt.getMinutes()+dt.getSeconds();
    const now = dt.toISOString();

    if (event.body && event.body !== "") {
        params = JSON.parse(event.body);
    }

    if (params.hasOwnProperty('channelName')) {
        channelName = params.channelName;
        console.info("event channelName: " + channelName);
    } else {
        channelName = "default-" + formatted;
        console.info("default channelName: " + channelName);
    }

    const response = {
        statusCode: 200,
        body: "",
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    };

    // cretaeChannel
    let channelParams = {
        authorized: false,
        latencyMode: 'LOW',
        name: channelName,
        type: 'STANDARD',
        recordingConfigurationArn: ivsRecordConfArn
    };

    try {
        const queryParams = {
            TableName: tableName,
            Key: {
                "channel_name": channelName
            }
        };

        const channel = await dynamodb.get(queryParams).promise();
        if (!isEmpty(channel)) {
            console.info(channel);
            response.statusCode = 500;
            response.body = channelName + " 이미 등록된 채널 이름입니다.";
            return response;
        }

        const data = await ivs.createChannel(channelParams).promise();
        console.info("IVS createChannel > Success");

        const channelResponse = {
            ingestEndpoint: data.channel.ingestEndpoint,
            channelName: data.channel.name,
            streamKey: data.streamKey.value,
            startTime: now
        };
        response.body = JSON.stringify(channelResponse);

        const insertParams = {
            TableName:'channel',
            Item: {
                'channel_name': data.channel.name,
                'channel_arn': data.channel.arn,
                'channel_ingest_endpoint': data.channel.ingestEndpoint,
                'channel_title': params.channelTitle,
                'channel_type': 'LIVE',
                'stream_key_arn': data.streamKey.arn,
                'stream_key': data.streamKey.value,
                'lat': params.lat,
                'long': params.long,
                'start_time': now,
                'end_time': "",
                'playback_url': data.channel.playbackUrl,
                'thumbnail_url': "",
            }
        };
        await dynamodb.put(insertParams).promise();

    } catch (err) {
        console.error('ERROR: IVS createChannel', err);
        response.statusCode = 500;
        response.body = err.stack;
    }


    console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);

    return response;
};

let isEmpty = function(value) {
    return value == "" || value == null || value == undefined || (value != null && typeof value == "object" && !Object.keys(value).length);
};