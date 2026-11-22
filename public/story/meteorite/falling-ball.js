const floorY = -.71;
const ballRadius = .39;
const floorGap = .055;

export function createFallingBall(room, { Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, Color, DoubleSide }) {
  for (const child of [...room.children]) {
    if (child.name === 'LAMP_axes' || child.name.startsWith('TableBase')) child.removeFromParent();
  }

  // Take one of the black discs from the back wall and send it into the room.
  const ball = room.getObjectByName('BallDecor002');
  const start = ball.position.clone();
  ball.removeFromParent();

  const stage = new Group();
  const body = new Group();
  stage.add(body);
  ball.position.set(0, 0, .018);
  ball.scale.setScalar(ballRadius / .237);
  ball.material = new MeshBasicMaterial({ color: '#0c0c11', side: DoubleSide });

  const rim = ball.clone();
  rim.position.set(-.009, -.037, .006);
  rim.material = new MeshBasicMaterial({ color: '#ffe8aa', side: DoubleSide });
  body.add(rim, ball);

  const time = { value: 0 };
  const intensity = { value: 0 };
  const heat = { value: 0 };
  const vertexShader = `
    varying vec2 inkUV;
    void main() {
      inkUV = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }
  `;

  // The old lamp's wavy orange edge becomes the fire around and behind the ball.
  const flame = new Mesh(new PlaneGeometry(1.65, 2.08), new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      time, intensity,
      amber: { value: new Color('#ffad13') },
      red: { value: new Color('#eb6c1e') },
      cream: { value: new Color('#fff0be') },
    },
    vertexShader,
    fragmentShader: `
      uniform float time, intensity;
      uniform vec3 amber, red, cream;
      varying vec2 inkUV;
      void main() {
        float y = inkUV.y * 2.08 - .43;
        float fall = clamp(y / 1.59, 0., 1.);
        float x = (inkUV.x - .5) * 1.65;
        float bend = .075 * sin(y * 4.6 - time * 3.5) * fall;
        float width = .525 * smoothstep(-.43, -.02, y) * (1. - smoothstep(.24, 1.54, y));
        float ripples = .049 * sin(y * 52. + time * 9.) + .026 * sin(y * 83. - time * 6.);
        float waves = ripples * smoothstep(-.39, .12, y) * (1. - smoothstep(1.25, 1.57, y));
        float edgeDistance = width + waves - abs(x - bend);
        float cover = smoothstep(-.01, .002, edgeDistance) * (1. - smoothstep(1.47, 1.62, y));
        float outline = 1. - smoothstep(.006, .023, edgeDistance);
        float hotCore = (1. - smoothstep(.043, .47, abs(x - bend))) * (1. - smoothstep(.03, .94, y));
        float paperGrain = fract(sin(dot(floor(gl_FragCoord.xy), vec2(41.13, 73.91))) * 16759.61);
        vec3 color = mix(amber, red, fall * .59);
        color = mix(color, cream, max(outline * .60, hotCore * .73));
        gl_FragColor = vec4(color * (.86 + .14 * paperGrain), cover * intensity);
        #include <colorspace_fragment>
      }
    `,
  }));
  flame.position.set(0, .61, -.01);
  body.add(flame);

  const shadow = new Mesh(new PlaneGeometry(1.16, .76), new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { heat },
    vertexShader,
    fragmentShader: `
      uniform float heat;
      varying vec2 inkUV;
      void main() {
        float distanceToCenter = length((inkUV - .5) * 2.);
        float shade = 1. - smoothstep(.18, 1., distanceToCenter);
        gl_FragColor = vec4(.10, .06, .09, .65 * heat * shade);
      }
    `,
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, floorY + .003, .34);
  stage.add(shadow);

  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  const clamp = value => Math.max(0, Math.min(1, value));
  return {
    group: stage,
    update(elapsed, progress, aspect) {
      const sequence = clamp((progress - .13) / .42);
      const approach = sequence * sequence * (3 - 2 * sequence);
      const fit = Math.min(1, .44 + .62 * aspect);
      const endX = -.33 + .30 * clamp((.85 - aspect) / .39);
      const endY = floorY + (ballRadius + .037) * fit + floorGap;
      body.position.set(
        start.x + (endX - start.x) * approach,
        start.y + (endY - start.y) * approach,
        start.z + (.34 - start.z) * approach,
      );
      body.rotation.z = -.66 + .08 * approach;
      body.scale.setScalar(fit * (.63 + .37 * approach));
      time.value = motion.matches ? elapsed * .001 : 0;
      intensity.value = clamp((sequence - .07) / .37);
      shadow.position.x = endX;
      shadow.scale.setScalar(fit);
      heat.value = approach ** 5;
    },
  };
}
