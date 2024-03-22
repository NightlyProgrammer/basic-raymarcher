#version 330 core

layout (location = 0) out vec4 fragColor;

in vec2 fragPos;
in vec2 uv;

#define PI 3.14159265359

uniform float time;
uniform vec3 camera_pos;
uniform vec3 camera_rotation;

uniform sampler2D sky_texture;
uniform sampler2D normal_tex;
//uniform sampler2D last_frame_texture;

mat3 rotation(int axis,float angle){
    switch (axis){
        case 0:
            //x axis
            return mat3(
                1,0,0,
                0,cos(angle),-sin(angle),
                0,sin(angle),cos(angle)
            );
        case 1:
            //y axis
            return mat3(
                cos(angle),0,sin(angle),
                0,1,0,
                -sin(angle),0,cos(angle)
            );
        case 2:
            //z axis
            return mat3(
                cos(angle),-sin(angle),0,
                sin(angle),cos(angle),0,
                0,0,1
            );
    };
};

float sphere_sdf(vec3 pos1,vec3 pos2){
    float r = 1;
    return distance(pos1,pos2)-r;
};

float torus_sdf(vec3 p, vec2 t )
{
  vec2 q = vec2(length(p.xz)-t.x,p.y);
  return length(q)-t.y;
}

float box_sdf( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
};

float round_box_sdf( vec3 p, vec3 b, float r )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
};

float sdf_floor(vec3 pos1,vec3 pos2){
    return length(pos1.y-pos2.y);
}

float cut_hollow_sphere_sdf( vec3 p, float r, float h, float t )
{
  // sampling independent computations (only depend on shape)
  float w = sqrt(r*r-h*h);
  
  // sampling dependant computations
  vec2 q = vec2( length(p.xz), p.y );
  return ((h*q.x<w*q.y) ? length(q-vec2(w,h)) : 
                          abs(length(q)-r) ) - t;
}


float larp(float a ,float b,float k){//larp function lienar interpolation
    return a*k+(1-k)*b;
};
vec3 larp_vector(vec3 a,vec3 b,float k){
    return a*k+(1-k)*b;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
};
float smax(float a,float b,float k){
    return smin(a,b,-k);
};

float sdf(vec3 pos1,vec3 pos2){
    float d1 = round_box_sdf(pos2-pos1,vec3(1,1,1),0.2);
    float d2 = torus_sdf(pos2-(pos1+vec3(sin(time)+1,0,0)),vec2(1,0.45));
    float d3 = sphere_sdf(pos1+vec3(0.7,(sin(time*0.25)+1.5),-0.7),pos2);

    float d4 = box_sdf((pos2-(pos1+vec3(10,-0.5,5))),vec3(1,1,1));
    float d5 = cut_hollow_sphere_sdf(rotation(0,45)*rotation(1,-45)*(pos2-(pos1+vec3(10,-1,-5))),1,0.6,0.1);
    return min(min(smax(smin(d1,d2,0.3),-d3,0.05),d4),d5);
};

vec3 normal(vec3 pos,float mdist,float mdist2){
    float epsilon = 0.001;
    if(mdist<mdist2){
        vec3 vector1 = vec3(
            sdf(vec3(0,0,1),pos+vec3(epsilon,0,0)),
            sdf(vec3(0,0,1),pos+vec3(0,epsilon,0)),
            sdf(vec3(0,0,1),pos+vec3(0,0,epsilon))
        );
        vec3 vector2 = vec3(
            sdf(vec3(0,0,1),pos-vec3(epsilon,0,0)),
            sdf(vec3(0,0,1),pos-vec3(0,epsilon,0)),
            sdf(vec3(0,0,1),pos-vec3(0,0,epsilon))
        );
        return normalize(vector1-vector2);
    }else{
        vec3 vector1 = vec3(
            sdf_floor(vec3(0,0,1),pos+vec3(epsilon,0,0)),
            sdf_floor(vec3(0,0,1),pos+vec3(0,epsilon,0)),
            sdf_floor(vec3(0,0,1),pos+vec3(0,0,epsilon))
        );
        vec3 vector2 = vec3(
            sdf_floor(vec3(0,0,1),pos-vec3(epsilon,0,0)),
            sdf_floor(vec3(0,0,1),pos-vec3(0,epsilon,0)),
            sdf_floor(vec3(0,0,1),pos-vec3(0,0,epsilon))
        );
        return normalize(vector2-vector1);
    }
    
};

float shadow(vec3 pos,vec3 dir,float mind,float maxd,float k){
    float res = 1;
    float dist = mind;
    float lowest_shadow_return_val = 0.01;//originally 0
    for(int i;i<256 && dist<maxd;i++){
        float d = min(sdf(vec3(0,0,1),pos+dir*dist),sdf_floor(vec3(0,-2,1),pos+dir*dist));
        if (d<0.001){
            return lowest_shadow_return_val;
        }
        res = min( res,k*d/dist );//for soft shadows
        dist += d;
    }
    return lowest_shadow_return_val+res;
}
vec3 raymarch(vec3 position,vec3 direction,bool blinn){
    float dist = 0;
    int infinity = 100;
    float min_dist=infinity;
    float min_dist2 = infinity;
    float collision_dist = 0.001;

    //vec3 light_dir = normalize(vec3(-0.8,0.8,1));
    vec3 light_pos = vec3(2,5,2)*rotation(1,time);
    vec3 light_color = vec3(1,1,1);

    vec3 plane_color1 = vec3(0.8,0.8,0.8);
    vec3 plane_color2 = vec3(0.2,0.2,0.2);
    vec3 default_color = vec3(1,1,1);//vec3(0.8,0.8,0.8);

    float smallest_dist = infinity;
    float outline_min_dist = 0.03;

    float density = 0.01;//0.017;
    while (dist < infinity){
        min_dist = sdf(vec3(0,0,1),position+direction*dist);
        min_dist2 = sdf_floor(vec3(0,-2,1),position+direction*dist);
        dist += min(min_dist,min_dist2);
        if (min_dist < smallest_dist){
            smallest_dist = min_dist;
        }
        if (min(min_dist,min_dist2) <= collision_dist){
            
            vec3 hit_point = position+direction*dist;
            vec3 norm = normal(hit_point,min_dist,min_dist2);
            //get texture color at uv coord
            float scale = 1;
            vec3 texture_norm;
            if(false){
                vec3 colorXY,colorYZ,colorXZ;
                colorXY = texture2D(normal_tex,hit_point.xy*scale).rgb;
                colorYZ = texture2D(normal_tex,hit_point.yz*scale).rgb;
                colorXZ = texture2D(normal_tex,hit_point.xz*scale).rgb;
                vec3 texture_color = colorXY*abs(norm.z)+colorYZ*abs(norm.x)+colorXZ*abs(norm.y);
                texture_norm = (2*texture_color-1)*norm;//convert from object tangen space coords to world coords
            }else{
                texture_norm = norm;
            }
            //phong shader
            vec3 light_dir = normalize(light_pos-hit_point);// calc light dir if you use light with pos ,if youre using direcitonal light just comment this line out
            
            float diff = max(dot(texture_norm, light_dir), 0.0);
            vec3 diffuse = diff*light_color;

            float ambient_strength = 0.2;
            vec3 ambient = ambient_strength*light_color;
            
            vec3 specular = vec3(0,0,0);

            float spec;
            if(diff>0.0){
                if (blinn){
                    vec3 halfwayDir = normalize(light_dir+direction);
                    spec = pow(max(dot(texture_norm, halfwayDir), 0.0), 16);
                }else{
                    vec3 reflectDir = reflect(-light_dir,texture_norm);  
                    spec = pow(max(dot(direction, reflectDir), 0.0), 16);
                }
                float specularStrength = 0.6;
                specular = specularStrength * spec * light_color;
            }
            //phong shader end
            float in_shadow = shadow(hit_point,light_dir,0.01,min(distance(hit_point,light_pos),infinity),8);
            float fog = 1/exp(pow(pow(dist,1.16) * density,2));//distance fog so infinite plane just nicely disappears
            vec3 fog_color;
                if(fog<1){
                    //map vec3 direciton to a 2d uv
                float sphere_uv_x = atan(direction.z,direction.x)/(2*PI);
                float sphere_uv_y = atan(direction.y,sqrt(pow(direction.z,2)+pow(direction.x,2)))/(PI)+0.5;
                fog_color = texture2D(sky_texture,vec2(-sphere_uv_x,-sphere_uv_y)).rgb;
                }
            if(min_dist>min_dist2){//to have the little outlien even if there is a plane
                if (smallest_dist<=outline_min_dist){
                    vec3 point = normalize(hit_point);
                    vec3 col = 0.5 + 0.5*cos(vec3(time,time,time)+point.xyz+vec3(0,2,4));
                    return col*fog+(1-fog)*fog_color;
                }
                vec3 fragPosition = position+direction*dist;
                float total = floor(fragPosition.x) +
                              floor(fragPosition.z);
                bool isEven = mod(total, 2.0) == 0.0;
                return (ambient+(diffuse+specular)*in_shadow)*((isEven) ? plane_color1 : plane_color2)*fog+(1-fog)*fog_color;
            }
            return (ambient+(diffuse+specular)*in_shadow)*default_color*fog+(1-fog)*fog_color;//multiply with floot in_shadow which is 0 if there are any collision,so the less shadowy a point is the more diffuse and spec it gets
        };
    };
    float sphere_uv_x = atan(direction.z,direction.x)/(2*PI);
    float sphere_uv_y = atan(direction.y,sqrt(pow(direction.z,2)+pow(direction.x,2)))/(PI)+0.5;
    vec3 fog_color = texture2D(sky_texture,vec2(-sphere_uv_x,-sphere_uv_y)).rgb;
    float fog = 1/exp(pow(pow(dist,1.2) * density,2));
    if (smallest_dist<=outline_min_dist){
        vec3 point = normalize(position+direction*dist);
        vec3 col = 0.5 + 0.5*cos(vec3(time,time,time)+point.xyz+vec3(0,2,4));
        return col*fog+(1-fog)*fog_color;
    }else{
    return fog_color;
    }
};

void main(){
    //vec3 camera_pos = vec3(0,0,-1);
    float cam_to_screen = 0.9;
    vec3 pos = vec3(fragPos.x,fragPos.y,cam_to_screen)*rotation(0,camera_rotation.x)*rotation(1,camera_rotation.y)*rotation(2,camera_rotation.z)+camera_pos;
    //vec3 texture_col = texture(texture_0,uv).rgb;
    //float opacity = 0.9;//opacity to last screen for motion blur
    vec3 color = raymarch(pos,normalize(pos-camera_pos),false);
    fragColor = vec4(color,1);//vec4(color*opacity+texture2D(last_frame_texture,uv).rgb*(1-opacity),1.0);//the bool false determines wether or not phong or blinn phong is used
}