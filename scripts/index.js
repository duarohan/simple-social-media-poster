const cron = require("node-cron");
const cronSchedule = require('./schedule');

let crons = []

exports.startCron =  async ()=>{
            activeCrons =  cronSchedule.filter(el=>el.status === 'ACTIVE')
            crons = activeCrons.map(el=>{
                cron.id = el.id
                return cron.schedule(el.cronTab,async() =>{
                    const script = require(`./${el.script}.js`)
                    await script()
                },{
                    scheduled: false
              })
            })

            crons.map(el=>{
                el.start()
            })
        }