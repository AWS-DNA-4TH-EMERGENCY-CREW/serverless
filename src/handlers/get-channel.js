const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient();

const tableName = process.env.CHANNEL_TABLE;

exports.handler = async (event) => {
    console.info('getChannel received:', event);

    const response = {
        statusCode: 200,
        body: '',
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        }
    };

    try {
        // 단건 조회
        if (!isEmpty(event.pathParameters)) {
            const channelName = event.pathParameters.channelName;
            const queryParams = {
                TableName: tableName,
                Key: {
                    "channel_name": channelName
                }
            };

            const channel = await dynamodb.get(queryParams).promise();
            if (isEmpty(channel)) {
                console.log(channel);

                response.statusCode = 500;
                response.body = channelName + " 채널 정보를 가져오는데 실패했습니다.";
                return response;
            }

            response.body = JSON.stringify({
                channelName: channel.Item.channel_name,
                channelTitle: channel.Item.channel_title,
                channelType: channel.Item.channel_type,
                playbackUrl: channel.Item.playback_url,
                videoUrl: channel.Item.video_url,
                thumbnailUrl: channel.Item.thumbnail_url,
                lat: channel.Item.lat,
                long: channel.Item.long,
                startTime: channel.Item.start_time,
                endTime: channel.Item.end_time
            });
        } else {
            // 다건 조회
            const scanParams = {
                TableName: tableName
            };
            const channels = await dynamodb.scan(scanParams).promise();
            const channelsResponse = [];
            channels.Items.forEach(function(item){
                const channelResponse = {
                    channelName: item.channel_name,
                    channelTitle: item.channel_title,
                    channelType: item.channel_type,
                    playbackUrl: item.playback_url,
                    videoUrl: item.video_url,
                    thumbnailUrl: item.thumbnail_url,
                    lat: item.lat,
                    long: item.long,
                    startTime: item.start_time,
                    endTime: item.end_time,
                };

                channelsResponse.push(channelResponse);
            });

            response.body = JSON.stringify(channelsResponse);
        }

    } catch (err) {
        console.error('ERROR: IVS getChannel', err);
        response.statusCode = 500;
        response.body = err.stack;
    }

    console.log(response);

    return response;
};

let isEmpty = function(value) {
    return value == "" || value == null || value == undefined || (value != null && typeof value == "object" && !Object.keys(value).length);
};