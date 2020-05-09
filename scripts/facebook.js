const rp = require('request-promise')
const NodeCache = require( "node-cache" );
const myCache = new NodeCache({stdTTL: 4200, checkperiod: 120});

module.exports =  async function test(){
    console.log('Current Time', new Date())
    try{
        currentVideoToPost = trendingVideos[0]
        let trendingVideos = myCache.get('trendingVideos')
        trendingVideos.shift()
        myCache.set('trendingVideos') = trendingVideos
        const data = {
            message : `Title:${currentVideoToPost.title} \n
                       Published On : ${currentVideoToPost.publishedAt} \n
                       Channel Title : ${currentVideoToPost.channelTitle} \n
                       View Count : ${currentVideoToPost.viewCount}`,
            link :`https://www.youtube.com/watch?v=${currentVideoToPost.id}`
        }
        postId = await rp(
            {   
                method: 'POST',
                uri: `https://graph.facebook.com/v7.0/${process.env.pageId}/feed`, 
                qs: {
                    access_token: process.env.fbAccessToken,
                    ...data 
                },
                json: true
            }
        )
        console.log(postId)
    }catch(e){
        console.error('Error in posting data',e)
    }
    
}