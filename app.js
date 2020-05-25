require('dotenv').config()
const rp = require('request-promise')
const NodeCache = require( "node-cache" );
const myCache = new NodeCache({stdTTL: 4200, checkperiod: 120});
const repostAllowedDays = parseInt(process.env.repostAllowedDays)
const postIntervalinMin = parseFloat(process.env.postIntervalinHours) * 60
const postsInADay = 24 / parseFloat(process.env.postIntervalinHours)
const postRetentionCount = postsInADay * repostAllowedDays
/**
 * Cache objects being used-
 * trendingVideoCounter - maintains the count of when to poll youtube for trending videos again
 *                
 * trendingVideos - Maintains a set of 50 or less fresh trendingVideos
 *                  1. The whole list gets generated after completing 24 hr. from the start
 *                  2. In pre-processing stage, the new videos are matched with alreadyPosted videos are removed
 *                  3. This list gets updated hourly,(FIFO)
 * 
 * postedVideosSet - Maintains a set of posted videos from last 4 days. 
 *                1. Works on First In Last Out Stack of 96 elements (24 * 4). 
 *                2. List gets updated hourly.(FILO)
 *                   
 */
setInterval(async function(){
    await main()
},postIntervalinMin * 60 * 1000)

async function main(){
    try{
        let trendingVideos =[]
        if (!myCache.get('trendingVideoCounter') || myCache.get('trendingVideoCounter') === postsInADay){
            myCache.set('trendingVideoCounter', 1)
            trendingVideos = await getTrendingFor24Hours()
            const freshTrendingVideos = filterFreshTrendingVids(trendingVideos)
            myCache.set('trendingVideos', {list: freshTrendingVideos})
            trendingVideos = freshTrendingVideos
            await postOnFacebook(trendingVideos[0])
        }else{
            myCache.set('trendingVideoCounter', parseInt(myCache.get('trendingVideoCounter')) + 1)
            const trendingVideosObj = myCache.get('trendingVideos')
            trendingVideos = trendingVideosObj.list
            await postOnFacebook(trendingVideos[0])
        }
        filoOnPostedVideos(trendingVideos[0])
        removeFirstTrendingVideo(trendingVideos)
    }catch(e){
        console.error('Error in a process',e)   
    }
}

async function getTrendingFor24Hours(){
    let trendingVideos = []
    try{
        const response = await rp(
            {   
                method: 'GET',
                uri: `https://www.googleapis.com/youtube/v3/videos`, 
                qs: {
                    key: process.env.youtubeAccessToken,
                    chart : 'mostPopular',
                    part:'snippet,statistics',
                    regionCode : process.env.regionCode,
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
        return trendingVideos
    }catch(e){
        console.error('Error in getting data from youtube',e)
    }
}

async function postOnFacebook(currentVideoToPost){
    const data = {
        message : `Published On : ${currentVideoToPost.publishedAt} \n
                Channel Title : ${currentVideoToPost.channelTitle} \n
                View Count : ${currentVideoToPost.viewCount}`,
        link :`https://www.youtube.com/watch?v=${currentVideoToPost.id}`
    }
    try{
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
    }catch(e){
        console.error('Error in posting data',e)
        return
    }
    console.log('Posted on facebook',postId)
}

function difference(setA, setB) {
    let _difference = new Set(setA)
    for (let elem of setB) {
        _difference.delete(elem)
    }
    return _difference
}

function filterFreshTrendingVids(trendingVideos){
    let alreadyPosted = []
    let postedVideosSet = []
    const trendingVideoIds = trendingVideos.map(el=>el.id)
    const trendingVideosSet = new Set(trendingVideoIds)
    if (myCache.get('postedVideosSet')){
        alreadyPosted = myCache.get('postedVideosSet')
        postedVideosSet = new Set(alreadyPosted.list)
    }else{
        postedVideosSet = new Set([])
    }
    const freshTrendingVideoIds = [...difference(trendingVideosSet, postedVideosSet)]
    const freshTrendingVideos = trendingVideos.filter(el=> freshTrendingVideoIds.includes(el.id))
    return freshTrendingVideos
}

function removeFirstTrendingVideo(videos){
    videos.shift()
    myCache.set('trendingVideos', {'list' : videos})
}

function filoOnPostedVideos(currentVideoToPost){
    let alreadyPostedList = []
    if(myCache.get('postedVideosSet')){
        const postedVideosSet = myCache.get('postedVideosSet')
        alreadyPostedList = postedVideosSet.list
    } 
    if(alreadyPostedList.length <= postRetentionCount){
        alreadyPostedList.unshift(currentVideoToPost.id)
    }else{
        alreadyPostedList.pop()
        alreadyPostedList.unshift(currentVideoToPost.id)
    }
    myCache.set('postedVideosSet',{'list':alreadyPostedList})
    console.log('updated list', myCache.get('postedVideosSet'))
}

function postOnFacebookMock(currentVideoToPost){
    console.log('Posted on facebook',currentVideoToPost)
}