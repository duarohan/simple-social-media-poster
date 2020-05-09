const rp = require('request-promise')
const NodeCache = require( "node-cache" );
const myCache = new NodeCache({ stdTTL: 4200, checkperiod: 120 });

module.exports =  async function test(){
    console.log('Current Time', new Date())
    result = await getLiveFeed()
    console.log(result)
}

async function getLiveFeed(){
    videoDetails = []
    try{
        const response = await rp(
            {   
                method: 'GET',
                uri: `https://www.googleapis.com/youtube/v3/videos`, 
                qs: {
                    key: process.env.youtubeAccessToken,
                    chart : 'mostPopular',
                    part:'snippet,statistics',
                    regionCode : 'IN',
                    maxResults:50
                },
                json: true
            }
        )
        trendingVideos = response.items.map(el=>{
            return {
                id : el.id,
                publishedAt:el.snippet.publishedAt,
                title:el.snippet.title,
                channelTitle:el.snippet.channelTitle,
                viewCount:el.statistics.viewCount
            }
        })
        console.log('trendingVideos',trendingVideos)
        myCache.set('trendingVideos', trendingVideos)
    }catch(e){
        console.error('Error in getting data from youtube',e)
    }
}

