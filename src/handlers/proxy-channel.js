const AWS = require("aws-sdk");
const http = require('http');
const dynamodb = new AWS.DynamoDB.DocumentClient();


exports.handler = async (event, context) => {
    const response = {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: "",
    };

    const channelName = event.pathParameters.channelName;
    const queryParams = {
        TableName: "channel",
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

    let path = channel.Item.playback_url;
    let split = path.split("/");
    let rootUrl = split.slice(0, split.length - 1).join("/") + "/";
    let requestUrl = rootUrl + event.pathParameters.fileName;

    console.log(requestUrl);

    try {
        const result = await getRequest(requestUrl);

        response.headers = result.headers;
        response.body = result.body;

        return response;
    } catch (error) {
        console.log('Error is: ️', error);
        return {
            statusCode: 400,
            body: error.message,
        };
    }
};

function getRequest(requestUrl) {
    const url = requestUrl

    return new Promise((resolve, reject) => {
        const req = http.get(url, res => {
            console.log(res);
            let rawData = '';

            res.on('data', chunk => {
                rawData += chunk;
            });

            res.on('end', () => {
                try {
                    resolve({
                        body: rawData,
                        headers: res.headers
                    });
                } catch (err) {
                    reject(new Error(err));
                }
            });
        });

        req.on('error', err => {
            reject(new Error(err));
        });
    });
}

let isEmpty = function(value) {
    return value == "" || value == null || value == undefined || (value != null && typeof value == "object" && !Object.keys(value).length);
};