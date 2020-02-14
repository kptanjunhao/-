var lineWidth = 2;
var lineColor = "#000";

var c_width = Math.min(window.innerHeight,window.innerWidth) - 64;
if(Math.abs(window.innerWidth-window.innerHeight)<210) c_width = c_width - 210;


var canvas = document.getElementById('draw-canvas');
canvas.width = c_width;
canvas.height = c_width;
var context = canvas.getContext("2d");
context.fillStyle = '#FFF';
context.fillRect(0, 0, c_width, c_width);

// document.getElementById("rs").style.maxHeight = window.innerHeight-c_width-166+"px";


function drawStart(e) {
    var cr = e.isRemote?{left:0,top:0}:canvas.getBoundingClientRect();
    x = (e.clientX || e.touches[0].clientX) - cr.left;
    y = (e.clientY || e.touches[0].clientY) - cr.top;
    context.beginPath();
    context.moveTo(x, y);
    if(e.isRemote) return;
    post(x, y,lineWidth,lineColor,0);
}
function drawEnd(e)  {
    context.closePath();
    if(e && e.isRemote) return;
    post(0, 0,lineWidth,lineColor,2);
}
function drawCanvas(e) {
    var cr = e.isRemote?{left:0,top:0}:canvas.getBoundingClientRect();
    x = (e.clientX || e.touches[0].clientX) - cr.left;
    y = (e.clientY || e.touches[0].clientY) - cr.top;
    // context.globalCompositeOperation = 'destination-out';
    // context.arc(e.clientX, e.clientY, lineWidth, 0, Math.PI * 2, false);//获取当前鼠标的横纵坐标作为填充的位置
    // context.fillStyle = lineColor;
    // context.fill();
    context.lineTo(x,y);
    context.lineWidth = lineWidth;
    context.strokeStyle = lineColor;
    context.stroke();
    if(e.isRemote) return;
    post(x, y,lineWidth,lineColor,1);
    
}
function clearCanvas(isRemote) {
    context.fillStyle="#ffffff";
    context.beginPath();
    context.fillRect(0,0,c_width,c_width);
    context.closePath();
    if(!isRemote)postClear();
}
function setCanvasEnabled(isEnabled){
    canvas.isEnabled = isEnabled;
    document.getElementById("color-tool").style.display = isEnabled?"inline-block":"none";
    if(isEnabled){
        canvas.ontouchstart = function(e){
            drawStart(e);
        };
        canvas.ontouchend = function(e){
            drawEnd(e);
        };
        canvas.ontouchcancel = function(e){
            e.isRemote = true;// 设置为不发送给服务器
            canvas.ontouchend(e);
        };
        canvas.ontouchmove = function (e) {
            drawCanvas(e);
        };
        canvas.onmousedown = function(e){
            drawStart(e);
            canvas.onmousemove = function (e) {
                drawCanvas(e);
            };
        };
        canvas.onmouseup = function(e){
            canvas.onmousemove = function(e){ };
            drawEnd(e);
        };
        canvas.onmouseout = function(e){
            e.isRemote = true;// 设置为不发送给服务器
            canvas.onmouseup(e)
        };
        canvas.onmouseleave = canvas.onmouseout;
    }else{
        canvas.ontouchstart     = function(e){};
        canvas.ontouchend       = canvas.ontouchstart;
        canvas.ontouchmove      = canvas.ontouchstart;
        canvas.onmousedown      = canvas.ontouchstart;
        canvas.onmouseup        = canvas.ontouchstart;
    }
}