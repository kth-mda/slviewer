import * as d3 from './d3';
import _ from 'lodash';

var r = 20,
  width = 1000,
  height = 800;

var svg = d3.select('#graph')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

var diagramSite = svg.append('g');

svg.append('defs').append('marker')
  .attr("id", 'markerArrowEnd')
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 10)
  .attr("refY", 0)
  .attr("markerWidth", 8)
  .attr("markerHeight", 8)
  .attr("orient", "auto")
  .append("path")
  .attr("d", 'M0,-5 L10,0 L0,5')
  .attr('fill', 'black');

let simulation = d3.forceSimulation()
  .force("link", d3.forceLink().id(function(d) {return d.name; }))
  .force("charge", d3.forceManyBody());

function render() {
  d3.json('sch', function(error, data) {
    var blockByName = _.keyBy(data, 'name');
    console.log(blockByName);
    var dataLinks = blockByName['schematic'].lines, fixedLinks = [];
    // make maps for finding port index by port name
    _.forEach(data, function(block) {
      block.inPortIndexByName = _.reduce(block.inPorts, (map, port, i)=>{map[port.name] = i; return map}, new Map());
      block.outPortIndexByName = _.reduce(block.outPorts, (map, port, i)=>{map[port.name] = i; return map}, new Map());
    });
    console.log(dataLinks);

    renderDiagram();

    function yByPortIndex(i) {
      return 20 + i * 20;
    }

    function renderDiagram() {
      var fixedLinks = _.map(dataLinks, function(link) {
        return {
          source: blockByName[link.from.block],
          target: blockByName[link.to.block]
        };
      });

      simulation
        .force("center", d3.forceCenter(width / 2, height / 2));
      simulation.nodes(data);
      simulation.force("link").links(fixedLinks).distance(200);
      simulation.on("tick", tick);
      simulation.on('end', function(d) { console.log('end');});
      simulation.alphaMin(0.5);

      // render node
      var nodes = diagramSite.selectAll('.node')
        .data(data, d=>d.name);

      nodes.exit().remove();

      var nodesEnter = nodes.enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', 'translate(50, 50)');

      nodesEnter.append('rect');

      nodesEnter.append('text')
        .text(d=>d.name)
        .attr('class', 'nodeName');

      nodesEnter.append('text')
        .text('')
        .attr('class', 'inPorts');

      nodesEnter.append('text')
        .text('')
        .attr('class', 'outPorts');

      nodesEnter
        .call(d3.drag().on('drag', function(d) {
          d.x = d3.event.x;
          d.y = d3.event.y;
          tick();
        }));

      let nodesEnterUpdate = nodesEnter.merge(nodes);

      nodesEnterUpdate.each(function(d) {
        var g = d3.select(this);
        var rect = g.select('rect');

        var inPorts = d3.select(this).select('.inPorts');
        inPorts.selectAll('tspan')
          .data(d.inPorts)
          .enter().append('tspan')
            .attr('x', '.2em')
            .attr('y', (d, i)=>yByPortIndex(i))
            .text(d=>d.name);
        var inPortsBBox = inPorts.node().getBBox();

        var outPorts = d3.select(this).select('.outPorts');
        outPorts.selectAll('tspan')
          .data(d.outPorts)
          .enter().append('tspan')
            .attr('x', 4)
            .attr('y', (d, i)=>yByPortIndex(i))
            .attr('text-anchor', 'end')
            .text(d=>d.name);
        var outPortsBBox = outPorts.node().getBBox();

        var rectWidth = Math.max(70, inPortsBBox.width + 20 + outPortsBBox.width);
        rect.attr('width', rectWidth);
        rect.datum().width = rectWidth;
        rect.attr('height', Math.max(30, inPortsBBox.height, outPortsBBox.height) + 12);
        outPorts.selectAll('tspan').attr('x', rectWidth - 4);

        var text = g.select('.nodeName');
        var bb = text.node().getBBox();
        text
          .attr('x', (rect.attr('width') - bb.width) / 2)
          .attr('y',  parseInt(rect.attr('height')) + bb.height - 3);

      });


      // render lines
      var lines = diagramSite.selectAll('.line')
        .data(dataLinks, d=>d.from.block + '_' + d.from.port + '_' + d.to.block + '_' + d.to.port);

      lines.exit().remove();

      var linesEnter = lines.enter()
        .append('line')
        .attr('class', 'line')
        .attr('marker-end', 'url(#markerArrowEnd)');

      let linesEnterUpdate = linesEnter.merge(lines);

      function tick() {
        var q = d3.quadtree().addAll(data),
          i = 0,
          n = data.length;

        while (++i < n) q.visit(collide(data[i]));

        r = 100;
        var xRange = d3.extent(data, d=>d.x);
        var yRange = d3.extent(data, d=>d.y);
        var bounds = {x: xRange[0] - 2 * r, y: yRange[0] - 2 * r, width: xRange[1] - xRange[0] + 4 * r, height: yRange[1] - yRange[0] + 4 * r};

        svg
          .attr('width', bounds.width + 1000)
          .attr('height', bounds.height + 1000);
        diagramSite.attr('transform', 'translate(' + -bounds.x + ',' + -bounds.y + ')');

        nodesEnterUpdate.each(function(d) {
          d3.select(this)
            .attr('transform', 'translate(' + d.x + ', ' + d.y + ')');

        });

        linesEnterUpdate.each(function(d) {
          if (d.from.block !== 'schematic' && d.to.block !== 'schematic') {
            var fromBlock = blockByName[d.from.block],
              fromPortIndex = fromBlock.outPortIndexByName[d.from.port],
              toBlock = blockByName[d.to.block],
              toPortIndex = toBlock.inPortIndexByName[d.to.port];

            d3.select(this)
              .attr("x1", function(d) {
                return fromBlock.x + fromBlock.width;
              })
              .attr("y1", function(d) {
                return fromBlock.y + yByPortIndex(fromBlock.outPortIndexByName[d.from.port]);
              })
              .attr("x2", function(d) {
                return toBlock.x;
              })
              .attr("y2", function(d) {
                return toBlock.y + yByPortIndex(toPortIndex);
              });
          }
        });
      }
    }
  });
}

function collide(node) {
  var r = node.radius + 16,
    nx1 = node.x - r,
    nx2 = node.x + r,
    ny1 = node.y - r,
    ny2 = node.y + r;
  return function(quad, x1, y1, x2, y2) {
    if (quad.point && (quad.point !== node)) {
      var x = node.x - quad.point.x,
        y = node.y - quad.point.y,
        l = Math.sqrt(x * x + y * y),
        r = node.radius + quad.point.radius;
      if (l < r) {
        l = (l - r) / l * .5;
        node.x -= x *= l;
        node.y -= y *= l;
        quad.point.x += x;
        quad.point.y += y;
      }
    }
    return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
  };
}

d3.select('#reload').on('click', function() {
  render();
})

render();
