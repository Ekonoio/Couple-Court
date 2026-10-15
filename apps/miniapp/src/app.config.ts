export default {
 pages: ['pages/index/index',...(process.env.TARO_APP_DEVTOOLS==='1'?['pages/dev/index']:[])],
 window:{navigationBarTitleText:'情侣法庭',navigationBarBackgroundColor:'#f7f4ee',navigationBarTextStyle:'black',backgroundColor:'#f7f4ee'},
}
