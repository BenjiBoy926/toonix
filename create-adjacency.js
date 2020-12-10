class HalfEdgeRecord
{
	constructor(vert, next,twin) {
    	this.vert = vert;
    	this.next = next;
    	this.twin = twin;
  	}
}

var buildBuf= function( gl, type, data, itemSize ){
    var buffer = gl.createBuffer();
    var arrayView = type === gl.ARRAY_BUFFER ? Float32Array : Uint16Array;
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, new arrayView(data), gl.STATIC_DRAW);
    buffer.itemSize = itemSize;
    buffer.numItems = data.length / itemSize;
    return buffer;
  }

/* create DCEL for triangle mesh, a new indice buffer */
//inspired by https://prideout.net/blog/old/blog/index.html@p=54.html
function createAdjanceyBuffer(mesh)
{
	/*
	mesh.vertexBuffer
	mesh.normalBuffer
	mesh.indexBuffer.numItems/3
	*/
	var adjanceyBuff = [];
	var edgeList = [];

	var pointMap = new Map();
	//In a triangle mesh every three indices form a triangle face, i think?
	for(var i = 0; i < mesh.indexBuffer.numItems; i = i + 3)
	{
		var a = mesh.indexBuffer[i];
		var b = mesh.indexBuffer[i+1];
		var c = mesh.indexBuffer[i+2];
		var hER = new HalfEdgeRecord(a,i+1,null);
		//indices are unsigned shorts, so we can do cool 
		//    things to create hashes to represent edges
		pointMap.set(c|(a<<16),i);
		edgeList.push(hER);

		hER = new HalfEdgeRecord(b,i+2,null);
		pointMap.set(a|(b<<16),i+1);
		edgeList.push(hER);

		hER = new HalfEdgeRecord(c,i,null);
		pointMap.set(b|(c<<16),i+2);
		edgeList.push(hER);
	}

	if(pointMap.size != mesh.indexBuffer.numItems){
		console.log("NOT A CLEAN TRIANGLE MESH!");
	}

	var boundaryCount = 0;
	//extremely cool way of reversing the hash to get edge pair
	pointMap.forEach((value, key) => {
    	var twin = pointMap.get((value>>16)|((0xffff&value)<<16));
    	if(twin == undefined)
    	{
    		boundaryCount = boundaryCount + 1;
    	}
    	else
    	{
    		edgeList[key].twin = twin;
    		edgeList[twin].twin = key;
    	}
	});

	//adjacency info, store the next twin edge vertex next to vert of edge in buffer
	if(boundaryCount > 0)
	{
		console.log("NOT A CLOSED MESH!");
		for(var i = 0; i < mesh.indexBuffer.numItems; i = i + 3)
		{
			adjanceyBuff.push(edgeList[i+2].vert);
			adjanceyBuff.push((edgeList[i].twin == null)?adjanceyBuff[adjanceyBuff.size-1]:edgeList[edgeList[edgeList[i].twin].next].vert);
			adjanceyBuff.push(edgeList[i].vert);
			adjanceyBuff.push((edgeList[i+1].twin == null)?adjanceyBuff[adjanceyBuff.size-2]:edgeList[edgeList[edgeList[i+1].twin].next].vert);
			adjanceyBuff.push(edgeList[i+1].vert);
			adjanceyBuff.push((edgeList[i+2].twin == null)?adjanceyBuff[adjanceyBuff.size-3]:edgeList[edgeList[edgeList[i+2].twin].next].vert);
		}
	}
	else
	{
		for(var i = 0; i < mesh.indexBuffer.numItems; i = i + 3)
		{
			//going to hope this is pushing an unsigned short
			adjanceyBuff.push(edgeList[i+2].vert);
			adjanceyBuff.push(edgeList[edgeList[edgeList[i].twin].next].vert);
			adjanceyBuff.push(edgeList[i].vert);
			adjanceyBuff.push(edgeList[edgeList[edgeList[i+1].twin].next].vert);
			adjanceyBuff.push(edgeList[i+1].vert);
			adjanceyBuff.push(edgeList[edgeList[edgeList[i+2].twin].next].vert);
		}
	}
	return adjanceyBuff;
}