<!--- SPDX-FileCopyrightText: 2024 Tim Hegemann <hegemann@informatik.uni-wuerzburg.de>
      SPDX-License-Identifier: CC-BY-4.0
--->
graph-harvester-react
=====================

React port of the [graph harvester](https://github.com/JuliusDeynet/graph_harvester) webapp.  
Graph Harvester is a program that extracts graphs from drawings of graphs in pdf files.
We focus on the problem of extracting graphs from vector data, which is the primary format
used in publications nowadays.

Play with our [demo instance](https://www1.pub.informatik.uni-wuerzburg.de/pub/hegemann/harvester/).


How To Use
----------

Use the Graph Harvester applet like any other react component.

```jsx
<GraphHarvesterApplet />
```

The applet can be customized via optional properties.

 * `baseUrl`: the url of the backend component
 * `hogUrl`: the House of Graphs url
 * `showUrlInput`: enables users to query URLs as an alternative to uploading pdf files


Publication
-----------

Most of the algorithms are described in

Julius Deynet, Tim Hegemann, Sebastian Kempf, Alexander Wolff.
[Graph Harvester (Software Abstract).](https://doi.org/10.4230/LIPIcs.GD.2024.58)
GD2024, vol.320 of LIPIcs, pp.58:01–58:03, Schloss Dagstuhl – Leibniz-Zentrum für Informatik (2024)


Contributors
------------

This library has been developed by the [algorithms and complexity group](https://www.informatik.uni-wuerzburg.de/algo)
in cooperation with the [applied computer science group](https://www.informatik.uni-wuerzburg.de/is),
University of Würzburg, Germany.

For contact, you can write an email to ``hegemann *at* informatik *dot* uni-wuerzburg *dot* de``.


